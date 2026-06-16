const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const TEMPLATE_ID = '370d0aaf19d08033b99bf17d506373fd';

async function inspect() {
  console.log(`Inspecting template page ${TEMPLATE_ID}...`);
  try {
    const blocks = await notion.blocks.children.list({ block_id: TEMPLATE_ID });
    console.log(`Loaded ${blocks.results.length} blocks:`);
    for (const [idx, block] of blocks.results.entries()) {
      console.log(`\nBlock #${idx}: type=${block.type}, id=${block.id}, has_children=${block.has_children}`);
      
      let text = '';
      if (block[block.type]?.rich_text) {
        text = block[block.type].rich_text.map(t => t.plain_text).join('');
        console.log(`  Text: "${text}"`);
      }
      
      if (block.has_children) {
        const children = await notion.blocks.children.list({ block_id: block.id });
        console.log(`  Children count: ${children.results.length}`);
        for (const [cIdx, child] of children.results.entries()) {
          let cText = '';
          if (child[child.type]?.rich_text) {
            cText = child[child.type].rich_text.map(t => t.plain_text).join('');
          }
          console.log(`    - Child #${cIdx}: type=${child.type}, text="${cText}"`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

inspect();
