const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const targets = ['Series', 'Comics', 'Games', 'Books', 'Anime', 'Manga'];

async function searchExact(query) {
  let cursor;
  let matches = [];
  console.log(`Searching for "${query}" with exact matching...`);
  
  for (let page = 0; page < 5; page++) { // page through up to 500 items
    try {
      const res = await notion.search({
        query: query,
        filter: { value: 'page', property: 'object' },
        start_cursor: cursor,
        page_size: 100
      });
      
      for (const p of res.results) {
        const title = p.properties?.title?.title?.map(x => x.plain_text).join('') ||
                      p.properties?.Name?.title?.map(x => x.plain_text).join('') || '';
        
        const cleanTitle = title.trim();
        if (cleanTitle.toLowerCase() === query.toLowerCase()) {
          matches.push({ title: cleanTitle, id: p.id, url: p.url });
        }
      }
      
      if (!res.next_cursor) break;
      cursor = res.next_cursor;
      // Sleep briefly to be friendly to rate limits
      await new Promise(r => setTimeout(r, 400));
    } catch (err) {
      console.error(`Error searching for "${query}":`, err.message);
      break;
    }
  }
  return matches;
}

async function run() {
  const allResults = {};
  for (const t of targets) {
    const matches = await searchExact(t);
    console.log(`Query "${t}" returned matching exact pages:`, matches);
    if (matches.length > 0) {
      allResults[t] = matches[0].id;
    }
    // Delay between targets
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('\nFINAL RESOLVED DASHBOARDS:');
  console.log(JSON.stringify(allResults, null, 2));
}

run();
