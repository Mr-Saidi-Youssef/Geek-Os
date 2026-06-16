const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '8b2780bfd84442d8bcd95223152c0ece';

const notion = new Client({ auth: NOTION_TOKEN });

async function run() {
  try {
    const res = await notion.databases.query({
      database_id: DATABASE_ID,
      page_size: 5
    });
    console.log(`Found ${res.results.length} pages:`);
    for (const page of res.results) {
      console.log('--- Page:', page.id);
      console.log('Title:', page.properties.Title?.title?.[0]?.plain_text);
      console.log('Author Relation:', JSON.stringify(page.properties.Author?.relation));
      console.log('Genre Relation:', JSON.stringify(page.properties.Genre?.relation));
      console.log('Type:', page.properties.Type?.select?.name);
      console.log('Total Pages:', page.properties['Total Pages ']?.number);
      console.log('Cover URL:', page.cover?.external?.url || page.cover?.file?.url || 'No cover');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

run();
