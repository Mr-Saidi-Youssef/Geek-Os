const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MASTER_DB_ID = '36dd0aaf19d0800792e7dca0434c570c';
const notion = new Client({ auth: NOTION_TOKEN });

async function inspectMasterSchema() {
  console.log(`Querying Master Watchlist database schema (${MASTER_DB_ID})...`);
  try {
    const db = await notion.databases.retrieve({ database_id: MASTER_DB_ID });
    console.log(`Database Title: "${db.title?.[0]?.plain_text || 'Untitled'}"`);
    
    console.log('\n--- Schema Properties ---');
    for (const [name, prop] of Object.entries(db.properties)) {
      console.log(`- Property Name: "${name}" | Type: "${prop.type}"`);
      if (prop.type === 'formula') {
        console.log(`  ↳ Formula Expression: ${prop.formula?.expression}`);
      }
    }
  } catch (err) {
    console.error('Error inspecting database:', err.message);
  }
}

inspectMasterSchema();
