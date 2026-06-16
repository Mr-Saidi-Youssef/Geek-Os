const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const pageId = '36bd0aaf19d08039b1dffb867c316ea8';

async function checkPage() {
  try {
    console.log('Retrieving page details for ID:', pageId);
    const page = await notion.pages.retrieve({ page_id: pageId });
    console.log('Page Title:', page.properties?.title?.title[0]?.plain_text || page.properties?.Name?.title[0]?.plain_text || 'Untitled');
    console.log('Page Details:', JSON.stringify(page, null, 2));

    console.log('\nRetrieving page blocks...');
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    console.log('Total child blocks found:', blocks.results.length);
    for (const block of blocks.results) {
      console.log(`- Block ID: ${block.id}, Type: ${block.type}`);
      if (block.type === 'child_database') {
        console.log(`  * Database Title: ${block.child_database.title}`);
      }
    }
  } catch (err) {
    console.error('Error retrieving page:', err.message);
  }
}

checkPage();
