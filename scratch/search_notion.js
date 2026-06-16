const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function search() {
  const res = await notion.search({
    query: 'Arcane',
    filter: { property: 'object', value: 'page' }
  });
  console.log('Search results for Arcane:');
  for (const page of res.results) {
    const titleProp = Object.values(page.properties).find(p => p.type === 'title');
    console.log(`- Page ID: ${page.id}, Title: "${titleProp?.title.map(x => x.plain_text).join('')}"`);
  }
}

search();
