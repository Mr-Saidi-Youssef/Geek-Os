const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function run() {
  console.log('🔍 Listing all pages in Books database...');
  try {
    const res = await notion.databases.query({ database_id: '8b2780bf-d844-42d8-bcd9-5223152c0ece' });
    console.log(`Found ${res.results.length} pages:`);
    for (const page of res.results) {
      const title = page.properties?.Title?.title?.map(x => x.plain_text).join('') ||
                    page.properties?.Name?.title?.map(x => x.plain_text).join('') || 
                    page.properties?.title?.title?.map(x => x.plain_text).join('') || '(Untitled)';
      console.log(`- "${title}" | ID: ${page.id} | is_template: ${page.is_template}`);
    }
  } catch (err) {
    console.error(err.message);
  }
}

run();
