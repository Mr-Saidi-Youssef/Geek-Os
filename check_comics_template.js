const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TEMPLATE_ID = '371d0aaf19d080088c08c9f95a2449f4';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function getBlocks(blockId) {
  let blocks = [];
  let cursor;
  while (true) {
    const { results, next_cursor } = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
    });
    blocks.push(...results);
    if (!next_cursor) break;
    cursor = next_cursor;
  }
  return blocks;
}

async function scanBlocks(blockId, depth = 0) {
  const blocks = await getBlocks(blockId);
  for (const block of blocks) {
    const type = block.type;
    const content = block[type];
    
    // Get text if available
    let textContent = '';
    if (content && content.rich_text) {
      textContent = content.rich_text.map(t => t.plain_text).join('');
    }
    
    const indent = ' '.repeat(depth * 2);
    console.log(`${indent}- Block ID: ${block.id} (${block.type}): "${textContent.substring(0, 100)}"`);
    
    if (block.has_children) {
      await scanBlocks(block.id, depth + 1);
    }
  }
}

async function start() {
  console.log(`Fetching blocks for template: ${TEMPLATE_ID}`);
  try {
    await scanBlocks(TEMPLATE_ID);
  } catch (error) {
    console.error('Error scanning blocks:', error);
  }
}

start();
