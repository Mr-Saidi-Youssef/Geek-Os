const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry(fn) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if ((err.status === 429 || err.code === 'rate_limited') && attempt < 7) {
        const delay = (attempt + 1) * 3500 + 2000;
        console.log(`Rate limited. Waiting ${delay}ms before retry...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

async function findExactPage(title) {
  console.log(`Searching for exact page: "${title}"...`);
  try {
    const res = await withRetry(() => notion.search({
      query: title,
      filter: { value: 'page', property: 'object' }
    }));
    
    for (const p of res.results) {
      const pageTitle = p.properties?.title?.title?.map(x => x.plain_text).join('') ||
                        p.properties?.Name?.title?.map(x => x.plain_text).join('') || '';
      if (pageTitle.trim().toLowerCase() === title.toLowerCase()) {
        console.log(`Matched page: "${pageTitle}" | ID: ${p.id} | URL: ${p.url}`);
        return p.id;
      }
    }
  } catch (err) {
    console.error(`Error searching for "${title}":`, err.message);
  }
  return null;
}

async function run() {
  const targets = ['Series', 'Comics', 'Games'];
  const dashboards = {};
  
  for (const t of targets) {
    const id = await findExactPage(t);
    if (id) {
      dashboards[t] = id;
    }
    await sleep(2000); // 2 second delay between searches
  }
  
  console.log('\n=== RESOLVED TARGET DASHBOARD PAGE IDs ===');
  console.log(JSON.stringify(dashboards, null, 2));
}

run();
