const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = '36dd0aaf19d0800792e7dca0434c570c'; // Anime DB

async function search() {
  console.log('Searching Anime database for "Frieren"...');
  try {
    const res = await notion.databases.query({
      database_id: DB_ID,
      filter: {
        property: 'Title',
        title: {
          contains: 'Frieren'
        }
      }
    });
    console.log(`Found ${res.results.length} pages for "Frieren":`);
    for (const page of res.results) {
      const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
      console.log(`- Page: "${title}" | ID: ${page.id}`);
      console.log(`  Cover:`, JSON.stringify(page.cover));
      for (const [propName, propVal] of Object.entries(page.properties)) {
        if (propVal.type === 'files') {
          console.log(`  Property [${propName}]:`, JSON.stringify(propVal.files));
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

search();
