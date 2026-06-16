const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '371d0aaf19d081c59b14fbc0c52b0040';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function checkComics() {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
    });
    console.log(`Found ${response.results.length} pages in the Comics database.`);
    for (const page of response.results) {
      const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
      console.log(`Page: "${title}" (ID: ${page.id})`);
    }
  } catch (error) {
    console.error('Error querying Comics database:', error);
  }
}

checkComics();
