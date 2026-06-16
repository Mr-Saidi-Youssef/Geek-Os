const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = '36dd0aaf19d0800792e7dca0434c570c'; // Anime Database

async function find() {
  console.log('Querying Anime database to find a good test page...');
  try {
    const res = await notion.databases.query({ database_id: DB_ID, page_size: 50 });
    console.log(`Found ${res.results.length} pages:`);
    for (const page of res.results) {
      const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
      console.log(`- Page: "${title}" | ID: ${page.id} | URL: ${page.url}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

find();
