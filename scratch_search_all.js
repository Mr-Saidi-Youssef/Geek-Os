const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function run() {
  try {
    console.log('Searching Notion Databases...');
    const responseDbs = await notion.search({
      filter: { property: 'object', value: 'database' }
    });
    console.log('--- ALL DATABASES ---');
    for (const db of responseDbs.results) {
      const title = db.title ? db.title.map(t => t.plain_text).join('') : 'Untitled';
      console.log(`- [DB] Name: ${title} | ID: ${db.id}`);
    }

    console.log('\nSearching Notion Pages matching keywords...');
    const responsePages = await notion.search({
      filter: { property: 'object', value: 'page' }
    });
    
    console.log('--- FILTERED PAGES ---');
    const keywords = ['tracker', 'journal', 'financial', 'workout', 'reading', 'watchlist', 'tasks', 'byronotion', 'byron'];
    for (const page of responsePages.results) {
      let title = 'Untitled';
      if (page.properties) {
        for (const propName in page.properties) {
          const prop = page.properties[propName];
          if (prop.type === 'title') {
            title = prop.title.map(t => t.plain_text).join('');
            break;
          }
        }
      }
      
      const lowerTitle = title.toLowerCase();
      if (keywords.some(kw => lowerTitle.includes(kw))) {
        console.log(`- [Page] Name: ${title} | ID: ${page.id}`);
      }
    }
  } catch (error) {
    console.error('Search failed:', error);
  }
}

run();
