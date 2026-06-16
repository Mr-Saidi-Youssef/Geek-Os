const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const pageId = '37ad0aaf19d0802299c1f0d8f4d2390e';

async function run() {
  try {
    console.log('Using token:', process.env.NOTION_TOKEN ? process.env.NOTION_TOKEN.substring(0, 10) + '...' : 'undefined');
    console.log('Fetching page details for:', pageId);
    const page = await notion.pages.retrieve({ page_id: pageId });
    console.log('Page Title:', page.properties.title?.title?.[0]?.plain_text || 'No Title');
    
    console.log('Fetching child blocks...');
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    console.log('Child blocks count:', blocks.results.length);
    for (const block of blocks.results) {
      console.log(`- Block type: ${block.type}, ID: ${block.id}`);
      if (block.type === 'child_database') {
        console.log(`  Database Title: ${block.child_database.title}`);
        try {
          const db = await notion.databases.retrieve({ database_id: block.id });
          console.log(`  Database Properties:`, Object.keys(db.properties));
        } catch (dbErr) {
          console.error(`  Error fetching database details for ${block.id}:`, dbErr.message);
        }
      }
    }
  } catch (err) {
    console.error('Error fetching page:', err.message);
  }
}
run();
