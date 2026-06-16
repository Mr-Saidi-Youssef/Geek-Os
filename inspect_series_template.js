const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TEMPLATE_ID = '370d0aaf-19d0-80da-ae71-d2b907a48250'; // New Series
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
  const indent = '  '.repeat(depth);
  for (const block of blocks) {
    const type = block.type;
    const content = block[type];
    
    let textContent = '';
    if (content && content.rich_text) {
      textContent = content.rich_text.map(t => t.plain_text).join('');
    }
    
    console.log(`${indent}- Block [${type}] (ID: ${block.id}): "${textContent.substring(0, 100)}"`);
    
    if (block.has_children) {
      await scanBlocks(block.id, depth + 1);
    }
  }
}

async function start() {
  console.log(`Inspecting Series Template Page ID: ${TEMPLATE_ID}`);
  try {
    const page = await notion.pages.retrieve({ page_id: TEMPLATE_ID });
    console.log(`Title: "${page.properties?.Title?.title?.[0]?.plain_text || page.properties?.Name?.title?.[0]?.plain_text || 'Untitled'}"`);
    console.log('--- Children blocks ---');
    await scanBlocks(TEMPLATE_ID);
  } catch (error) {
    console.error('Error scanning blocks:', error);
  }
}

start();
