const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const targets = ['Series', 'Anime', 'Manga', 'Comics', 'Games', 'Books'];

async function findDashboards() {
  console.log('Searching for dashboard pages in the workspace...');
  try {
    for (const t of targets) {
      const res = await notion.search({
        query: t,
        filter: { value: 'page', property: 'object' }
      });
      console.log(`\nQuery: "${t}" — Found ${res.results.length} pages:`);
      for (const p of res.results) {
        const title = p.properties?.title?.title?.map(x => x.plain_text).join('') ||
                      p.properties?.Name?.title?.map(x => x.plain_text).join('') || '(Untitled)';
        console.log(`- Page: "${title}" | ID: ${p.id} | URL: ${p.url}`);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

findDashboards();
