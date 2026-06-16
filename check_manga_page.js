const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const PAGE_ID = '36bd0aaf19d0808ca81ec4247c9d32c8';

async function check() {
  try {
    const page = await notion.pages.retrieve({ page_id: PAGE_ID });
    console.log('Successfully retrieved parent page:');
    console.log(`  Title: ${page.properties?.title?.title[0]?.plain_text || 'Untitled'}`);
    console.log(`  Page ID: ${page.id}`);
    
    // Retrieve page blocks to search for child databases
    const blocks = await notion.blocks.children.list({ block_id: PAGE_ID });
    console.log('\nChild blocks on page:');
    for (const block of blocks.results) {
      console.log(`  - Block ID: ${block.id}, Type: ${block.type}`);
      if (block.type === 'child_database') {
        console.log(`    \x1b[32m✔ Found Child Database: "${block.child_database.title}" (ID: ${block.id})\x1b[0m`);
      }
    }
  } catch (err) {
    console.error('Error retrieving page:', err.message);
  }
}

check();
