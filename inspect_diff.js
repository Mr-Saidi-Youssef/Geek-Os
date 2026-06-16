const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const page1Id = '374d0aaf19d08196acbac9d218aad61f';
const page2Id = '36ed0aaf19d081b0af55c3bf6e19a201';

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

async function inspectPage(pageId, name) {
  console.log(`\n======================================================`);
  console.log(`INSPECTING PAGE: ${name} (${pageId})`);
  console.log(`======================================================`);
  
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    console.log(`Title: "${page.properties.Title?.title?.[0]?.plain_text || 'Untitled'}"`);
    console.log(`Cover:`, page.cover?.external?.url || page.cover?.file?.url || 'No Cover');
    console.log(`Icon:`, page.icon ? JSON.stringify(page.icon) : 'No Icon');
    
    console.log('\nProperties:');
    for (const [key, val] of Object.entries(page.properties)) {
      console.log(`- ${key}: type=${val.type} | value=${JSON.stringify(val[val.type])}`);
    }

    const blocks = await getBlocks(pageId);
    console.log(`\nBlocks on page (Total: ${blocks.length}):`);
    for (const block of blocks) {
      let textContent = '';
      if (block[block.type] && block[block.type].rich_text) {
        textContent = block[block.type].rich_text.map(t => t.plain_text).join('');
      }
      console.log(`- [${block.type}] (ID: ${block.id}) | text: "${textContent.substring(0, 100)}"`);
      if (block.has_children) {
        const children = await getBlocks(block.id);
        console.log(`  ↳ Children (Total: ${children.length}):`);
        for (const child of children) {
          let childText = '';
          if (child[child.type] && child[child.type].rich_text) {
            childText = child[child.type].rich_text.map(t => t.plain_text).join('');
          }
          console.log(`    - [${child.type}] (ID: ${child.id}) | text: "${childText.substring(0, 80)}"`);
        }
      }
    }
  } catch (err) {
    console.error(`Error inspecting page ${name}:`, err.message);
  }
}

async function run() {
  await inspectPage(page1Id, 'Page 1 (Added via Site)');
  await inspectPage(page2Id, 'Page 2 (Correct Page)');
}

run();
