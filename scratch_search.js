const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function run() {
  try {
    console.log('Searching Notion...');
    const response = await notion.search({
      filter: {
        property: 'object',
        value: 'database'
      }
    });
    console.log('--- FOUND DATABASES ---');
    for (const db of response.results) {
      const title = db.title ? db.title.map(t => t.plain_text).join('') : 'Untitled';
      console.log(`- [DB] Name: ${title} | ID: ${db.id}`);
    }

    const responsePages = await notion.search({
      filter: {
        property: 'object',
        value: 'page'
      }
    });
    console.log('\n--- FOUND PAGES ---');
    for (const page of responsePages.results) {
      let title = 'Untitled';
      if (page.properties) {
        // Try standard page properties
        for (const propName in page.properties) {
          const prop = page.properties[propName];
          if (prop.type === 'title') {
            title = prop.title.map(t => t.plain_text).join('');
            break;
          }
        }
      }
      console.log(`- [Page] Name: ${title} | ID: ${page.id}`);
    }
  } catch (error) {
    console.error('Search failed:', error);
  }
}

run();
