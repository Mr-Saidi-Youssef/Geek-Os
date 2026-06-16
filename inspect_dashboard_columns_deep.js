const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function scanBlocks(blockId, depth = 0) {
  const res = await notion.blocks.children.list({ block_id: blockId });
  const indent = '  '.repeat(depth);
  for (const block of res.results) {
    let text = '';
    if (block[block.type]?.rich_text) {
      text = block[block.type].rich_text.map(t => t.plain_text).join('');
    } else if (block.type === 'child_database') {
      text = `Database: "${block.child_database.title}"`;
    }
    console.log(`${indent}- Block [${block.type}] (ID: ${block.id}): "${text.substring(0, 100)}"`);
    if (block.has_children) {
      await scanBlocks(block.id, depth + 1);
    }
  }
}

async function run() {
  const pageId = '36bd0aaf-19d0-80e9-8250-c93e3d89b1fd'; // Series
  console.log(`Deep scanning Series dashboard columns...`);
  try {
    await scanBlocks(pageId);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
