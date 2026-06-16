const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

async function run() {
  try {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    for (const [name, prop] of Object.entries(db.properties)) {
      if (prop.type === 'relation') {
        console.log(`Relation Name: "${name}"`);
        console.log(`Related Database ID: ${prop.relation.database_id}`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

run();
