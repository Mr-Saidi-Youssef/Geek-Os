const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function getBlockChildren(blockId, depth = 0) {
  try {
    const response = await notion.blocks.children.list({ block_id: blockId });
    for (const block of response.results) {
      const type = block.type;
      let title = '';
      if (type === 'child_page') {
        title = block.child_page.title;
        console.log(' '.repeat(depth * 2) + `- [Page] ${title} (${block.id})`);
        await getBlockChildren(block.id, depth + 1);
      } else if (type === 'child_database') {
        title = block.child_database.title;
        console.log(' '.repeat(depth * 2) + `- [DB] ${title} (${block.id})`);
      } else if (type === 'paragraph') {
        const text = block.paragraph.rich_text.map(t => t.plain_text).join('');
        if (text.trim()) {
          console.log(' '.repeat(depth * 2) + `P: ${text}`);
        }
      } else if (type.startsWith('heading_')) {
        const text = block[type].rich_text.map(t => t.plain_text).join('');
        if (text.trim()) {
          console.log(' '.repeat(depth * 2) + `H: ${text}`);
        }
      } else if (type === 'to_do') {
        const text = block.to_do.rich_text.map(t => t.plain_text).join('');
        console.log(' '.repeat(depth * 2) + `TODO [${block.to_do.checked ? 'x' : ' '}] ${text}`);
      } else if (type === 'bulleted_list_item') {
        const text = block.bulleted_list_item.rich_text.map(t => t.plain_text).join('');
        console.log(' '.repeat(depth * 2) + `* ${text}`);
        if (block.has_children) {
          await getBlockChildren(block.id, depth + 1);
        }
      } else if (type === 'numbered_list_item') {
        const text = block.numbered_list_item.rich_text.map(t => t.plain_text).join('');
        console.log(' '.repeat(depth * 2) + `1. ${text}`);
        if (block.has_children) {
          await getBlockChildren(block.id, depth + 1);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching block ' + blockId, error.message);
  }
}

async function run() {
  const rootId = '165d0aaf19d080a6a581c448ec8fb6d0'; // Byronotion Root Workspace ID
  console.log('--- FETCHING ROOT WORKSPACE CHILDREN ---');
  await getBlockChildren(rootId);
}

run();
