const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function start() {
  try {
    const res = await notion.search({
      filter: { property: 'object', value: 'database' }
    });
    console.log(`Found ${res.results.length} databases in the workspace:`);
    for (const db of res.results) {
      console.log(`- Database: "${db.title?.[0]?.plain_text || 'Untitled'}" | ID: ${db.id}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

start();
