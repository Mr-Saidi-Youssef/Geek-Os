const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = '36dd0aaf19d08123893fcbaf9bff624a';

async function search() {
  console.log('Searching TV database for "Breaking Bad"...');
  try {
    const res = await notion.databases.query({
      database_id: DB_ID,
      filter: {
        property: 'Title',
        title: {
          contains: 'Breaking Bad'
        }
      }
    });
    console.log(`Found ${res.results.length} pages:`);
    for (const page of res.results) {
      const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
      console.log(`- Page: "${title}" | ID: ${page.id} | URL: ${page.url}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

search();
