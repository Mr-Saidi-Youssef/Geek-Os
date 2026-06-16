const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const ANIME_DB_ID = '36dd0aaf19d0800792e7dca0434c570c'; // From .env: NOTION_DATABASE_ID

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function inspectScoreProperty() {
  console.log(`Retrieving Anime database schema (${ANIME_DB_ID})...`);
  try {
    const db = await notion.databases.retrieve({ database_id: ANIME_DB_ID });
    console.log(`Database Title: "${db.title?.[0]?.plain_text || 'Untitled'}"`);
    
    console.log('\nScanning for Select properties with rating options:');
    for (const [name, prop] of Object.entries(db.properties)) {
      if (prop.type === 'select') {
        const options = prop.select.options.map(opt => opt.name);
        console.log(`- Property Name: "${name}" | Type: "select"`);
        console.log(`  Options:`, JSON.stringify(options, null, 2));
      }
    }
  } catch (err) {
    console.error('Error inspecting Anime database:', err.message);
  }
}

inspectScoreProperty();
