const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const PAGE_ID = '370d0aaf-19d0-80b5-945e-df3f03ca5f51';

async function run() {
  try {
    const blocks = await notion.blocks.children.list({ block_id: PAGE_ID });
    console.log(`Blocks count on template: ${blocks.results.length}`);
    blocks.results.forEach((block, index) => {
      let extra = '';
      if (block.type === 'heading_1' || block.type === 'heading_2' || block.type === 'heading_3') {
        extra = `("${block[block.type].rich_text[0]?.plain_text || ''}")`;
      } else if (block.type === 'callout') {
        const text = block.callout.rich_text.map(t => t.plain_text).join('');
        extra = `("${text}")`;
      } else if (block.type === 'bulleted_list_item') {
        extra = `("${block.bulleted_list_item.rich_text.map(t => t.plain_text).join('')}")`;
      } else if (block.type === 'embed' || block.type === 'video') {
        extra = `(URL: ${block[block.type].external?.url || 'empty'})`;
      }
      console.log(`${index + 1}. Block ID: "${block.id}", Type: "${block.type}" ${extra}`);
    });
  } catch (err) {
    console.error('Error fetching blocks:', err.message);
  }
}

run();
