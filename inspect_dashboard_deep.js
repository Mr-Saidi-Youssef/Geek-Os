const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TARGET_ID = '36bd0aaf19d080a19157e9922d660f94';
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
    
    // Get text if available
    let textContent = '';
    if (content && content.rich_text) {
      textContent = content.rich_text.map(t => t.plain_text).join('');
    } else if (type === 'child_database') {
      textContent = `Database Title: "${content.title}"`;
    } else if (type === 'child_page') {
      textContent = `Page Title: "${content.title}"`;
    } else if (type === 'callout') {
      textContent = `Callout: "${content.rich_text?.map(t => t.plain_text).join('')}" | icon: ${JSON.stringify(content.icon)}`;
    } else if (type === 'link_to_page') {
      textContent = `Link to Page: ${JSON.stringify(content)}`;
    } else if (type === 'image') {
      textContent = `Image URL: ${content.external?.url || content.file?.url}`;
    }
    
    console.log(`${indent}- Block [${type}] (ID: ${block.id}): "${textContent.substring(0, 120)}"`);
    
    if (block.has_children) {
      await scanBlocks(block.id, depth + 1);
    }
  }
}

async function start() {
  console.log(`Deep scanning dashboard page: ${TARGET_ID}`);
  try {
    const page = await notion.pages.retrieve({ page_id: TARGET_ID });
    console.log(`Page Title: "${page.properties?.title?.title?.[0]?.plain_text || page.properties?.Name?.title?.[0]?.plain_text || 'Untitled'}"`);
    console.log(`Page Icon: ${JSON.stringify(page.icon)}`);
    console.log(`Page Cover: ${JSON.stringify(page.cover)}`);
    console.log('--- Children blocks ---');
    await scanBlocks(TARGET_ID);
  } catch (error) {
    console.error('Error scanning blocks:', error);
  }
}

start();
