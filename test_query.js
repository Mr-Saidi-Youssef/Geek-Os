const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function start() {
  try {
    const res = await notion.search({
      query: 'Watchmen'
    });
    console.log(`Found ${res.results.length} search results:`);
    for (const p of res.results) {
      console.log(`- Page/DB: "${p.title?.[0]?.plain_text || p.properties?.Title?.title?.[0]?.plain_text || 'Untitled'}" | ID: ${p.id} | Parent: ${JSON.stringify(p.parent)}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

start();
