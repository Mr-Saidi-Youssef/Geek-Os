const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const CALLOUT_BLOCK_ID = '370d0aaf-19d0-8057-9f3b-e8108493bc47';

async function run() {
  try {
    const children = await notion.blocks.children.list({ block_id: CALLOUT_BLOCK_ID });
    console.log(`Children inside Synopsis Callout (Count: ${children.results.length}):`);
    children.results.forEach((block, index) => {
      let extra = '';
      if (block.type === 'paragraph') {
        extra = `("${block.paragraph.rich_text.map(t => t.plain_text).join('')}")`;
      } else if (block.type === 'heading_3') {
        extra = `("${block.heading_3.rich_text.map(t => t.plain_text).join('')}")`;
      }
      console.log(`${index + 1}. Block ID: "${block.id}", Type: "${block.type}" ${extra}`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
