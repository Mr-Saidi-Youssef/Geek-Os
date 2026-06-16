const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = '370d0aaf-19d0-8121-a36f-f3dfcc914532';

async function check() {
  try {
    const db = await notion.databases.retrieve({ database_id: DB_ID });
    console.log('=== DATABASE PROPERTIES ===');
    for (const [name, prop] of Object.entries(db.properties)) {
      console.log(`- "${name}": type=${prop.type}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
