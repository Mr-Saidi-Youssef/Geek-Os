const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const AUTHORS_DB_ID = '367d0aaf-19d0-803e-ac0a-d33d3c82c581';
const GENRES_DB_ID = '37d28afc-7789-44af-8035-2bb161318e31';

const notion = new Client({ auth: NOTION_TOKEN });

async function inspect(dbId, name) {
  try {
    const db = await notion.databases.retrieve({ database_id: dbId });
    console.log(`=== Database: ${name} (${dbId}) ===`);
    console.log('Title:', db.title[0]?.plain_text || 'Untitled');
    for (const [propName, prop] of Object.entries(db.properties)) {
      console.log(`  Property Name: "${propName}", Type: "${prop.type}"`);
    }
    
    // Query 5 pages
    const res = await notion.databases.query({ database_id: dbId, page_size: 5 });
    console.log(`  Sample entries:`);
    for (const page of res.results) {
      // find title property
      let titleVal = '';
      for (const prop of Object.values(page.properties)) {
        if (prop.type === 'title') {
          titleVal = prop.title[0]?.plain_text || '';
        }
      }
      console.log(`    - ID: ${page.id}, Name: "${titleVal}"`);
    }
  } catch (e) {
    console.error(`Error inspecting ${name}:`, e.message);
  }
}

async function run() {
  await inspect(AUTHORS_DB_ID, 'Authors');
  await inspect(GENRES_DB_ID, 'Genres');
}

run();
