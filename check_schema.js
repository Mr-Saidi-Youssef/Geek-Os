const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '8b2780bfd84442d8bcd95223152c0ece';

const notion = new Client({ auth: NOTION_TOKEN });

async function run() {
  try {
    const db = await notion.databases.retrieve({ database_id: DATABASE_ID });
    console.log('Database Title:', db.title[0]?.plain_text || 'Untitled');
    for (const [name, prop] of Object.entries(db.properties)) {
      console.log(`Property Name: "${name}", Type: "${prop.type}", Details:`, JSON.stringify(prop[prop.type] || prop));
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

run();
