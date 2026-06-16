const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const PAGE_ID = '36ed0aaf-19d0-8188-bd15-da41113c665f'; // Breaking Bad

async function clear() {
  console.log(`Clearing all blocks from Breaking Bad page (${PAGE_ID})...`);
  try {
    const res = await notion.blocks.children.list({ block_id: PAGE_ID });
    console.log(`Found ${res.results.length} blocks to delete.`);
    for (const block of res.results) {
      await notion.blocks.delete({ block_id: block.id });
      console.log(`- Deleted block: ${block.id} (${block.type})`);
    }
    console.log('Clearing complete.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

clear();
