const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const templates = [
  'New Book',
  'New Manga',
  'New Games',
  'New Series',
  'New Anime',
  'New Comics'
];

async function run() {
  console.log('🔍 Searching for pages matching template names...');
  for (const t of templates) {
    try {
      const res = await notion.search({
        query: t,
        filter: { value: 'page', property: 'object' }
      });
      console.log(`\n========================================`);
      console.log(`Query: "${t}" (found ${res.results.length} pages)`);
      console.log(`========================================`);
      for (const p of res.results) {
        const title = p.properties?.Title?.title?.map(x => x.plain_text).join('') ||
                      p.properties?.Name?.title?.map(x => x.plain_text).join('') || 
                      p.properties?.title?.title?.map(x => x.plain_text).join('') || '(Untitled)';
        console.log(`- Title: "${title}" | ID: ${p.id} | Parent: ${p.parent.type} ID: ${p.parent.database_id || p.parent.page_id}`);
      }
    } catch (err) {
      console.error(err.message);
    }
  }
}

run();
