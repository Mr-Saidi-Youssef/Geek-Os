const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const templates = [
  'New Series',
  'New Anime',
  'New Manga',
  'New Comics',
  'New Games',
  'New Books'
];

async function findTemplates() {
  console.log('Searching for template pages...');
  for (const t of templates) {
    try {
      const res = await notion.search({
        query: t,
        filter: { value: 'page', property: 'object' }
      });
      console.log(`\nQuery: "${t}" — Found ${res.results.length} pages:`);
      for (const p of res.results) {
        const title = p.properties?.title?.title?.map(x => x.plain_text).join('') ||
                      p.properties?.Name?.title?.map(x => x.plain_text).join('') || '(Untitled)';
        if (title.toLowerCase().trim() === t.toLowerCase().trim()) {
          console.log(`* MATCH * Page: "${title}" | ID: ${p.id} | URL: ${p.url}`);
        } else {
          console.log(`- Page: "${title}" | ID: ${p.id}`);
        }
      }
    } catch (err) {
      console.error(`Error searching for "${t}":`, err.message);
    }
  }
}

findTemplates();
