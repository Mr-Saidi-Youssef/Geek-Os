const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function listDbs() {
  console.log('Listing all databases accessible by the integration...');
  try {
    const res = await notion.search({
      filter: { value: 'database', property: 'object' }
    });
    console.log(`Found ${res.results.length} databases:`);
    for (const db of res.results) {
      console.log(`- Title: "${db.title?.[0]?.plain_text || 'Untitled'}" | ID: ${db.id} | URL: ${db.url}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

listDbs();
