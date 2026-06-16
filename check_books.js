const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '8b2780bfd84442d8bcd95223152c0ece';

const notion = new Client({ auth: NOTION_TOKEN });

async function check() {
  try {
    const db = await notion.databases.retrieve({ database_id: DATABASE_ID });
    console.log('=== BOOKS DATABASE PROPERTIES ===');
    for (const [name, prop] of Object.entries(db.properties)) {
      console.log(`- "${name}": type=${prop.type}`);
    }
  } catch (err) {
    console.error('Error querying database:', err.message);
  }
}

check();
