const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TEMPLATE_ID = '370d0aaf-19d0-8056-8747-df3959410e3f'; // New Movie
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry(fn) {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if ((err.status === 429 || err.code === 'rate_limited') && attempt < 9) {
        const delay = (attempt + 1) * 3000 + 2000;
        console.log(`\nRate limited. Waiting ${delay}ms before retry...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

async function getBlocks(blockId) {
  let blocks = [];
  let cursor;
  while (true) {
    const { results, next_cursor } = await withRetry(() => notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
    }));
    blocks.push(...results);
    if (!next_cursor) break;
    cursor = next_cursor;
    await sleep(400); // Throttling
  }
  return blocks;
}

async function scanBlocks(blockId, depth = 0) {
  const blocks = await getBlocks(blockId);
  const indent = '  '.repeat(depth);
  for (const block of blocks) {
    const type = block.type;
    const content = block[type];
    
    // Get text if available
    let textContent = '';
    if (content && content.rich_text) {
      textContent = content.rich_text.map(t => t.plain_text).join('');
    } else if (type === 'child_database') {
      textContent = `Database Title: "${content.title}"`;
    } else if (type === 'child_page') {
      textContent = `Page Title: "${content.title}"`;
    } else if (type === 'callout') {
      textContent = `Callout: "${content.rich_text?.map(t => t.plain_text).join('')}"`;
    }
    
    console.log(`${indent}- Block [${type}] (ID: ${block.id}): "${textContent.substring(0, 100)}"`);
    
    if (block.has_children) {
      await scanBlocks(block.id, depth + 1);
    }
  }
}

async function start() {
  console.log(`Inspecting template page ID: ${TEMPLATE_ID}`);
  try {
    const page = await withRetry(() => notion.pages.retrieve({ page_id: TEMPLATE_ID }));
    console.log(`Title: "${page.properties?.Title?.title?.[0]?.plain_text || page.properties?.Name?.title?.[0]?.plain_text || 'Untitled'}"`);
    console.log(`Icon: ${JSON.stringify(page.icon)}`);
    console.log(`Cover: ${JSON.stringify(page.cover)}`);
    console.log('--- Children blocks ---');
    await scanBlocks(TEMPLATE_ID);
  } catch (error) {
    console.error('Error scanning blocks:', error);
  }
}

start();
