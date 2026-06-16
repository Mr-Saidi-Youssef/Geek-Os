const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '371d0aaf19d081c59b14fbc0c52b0040';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function inspectDb() {
  try {
    const db = await notion.databases.retrieve({ database_id: DATABASE_ID });
    console.log('Database Title:', db.title.map(t => t.plain_text).join(''));
    console.log('Database Properties Configuration:');
    for (const [key, value] of Object.entries(db.properties)) {
      console.log(`- ${key}: type=${value.type}`, JSON.stringify(value[value.type], null, 2));
    }
    
    // In Notion, we cannot list templates directly via API, but let's query the pages including templates if possible
    // Wait, the API doesn't support listing templates, but we can search for pages inside the database with templates
  } catch (error) {
    console.error('Error retrieving database details:', error);
  }
}

inspectDb();
