const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function run() {
  try {
    const db = await notion.databases.retrieve({ database_id: '8b2780bfd84442d8bcd95223152c0ece' });
    console.log('Book Database Type options:', JSON.stringify(db.properties.Type?.select?.options, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}

run();
