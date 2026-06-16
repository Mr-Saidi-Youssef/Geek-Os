const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '371d0aaf19d081c59b14fbc0c52b0040';
const notion = new Client({ auth: NOTION_TOKEN });

async function inspectSampleComic() {
  console.log('Querying first 5 comics in the database...');
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      page_size: 5
    });
    
    for (const page of response.results) {
      const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
      const synopsis = page.properties.Synopsis?.rich_text?.map(t => t.plain_text).join('') || '';
      console.log(`\nComic: "${title}" (ID: ${page.id})`);
      console.log(`- Synopsis Length: ${synopsis.length}`);
      console.log(`- Synopsis Value: "${synopsis.substring(0, 150)}..."`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectSampleComic();
