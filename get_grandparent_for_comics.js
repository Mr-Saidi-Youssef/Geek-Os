const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getParentPageId(currentParent) {
  let parent = currentParent;
  console.log('Starting traversal from parent type:', parent.type);
  while (true) {
    if (parent.type === 'page_id') {
      return parent.page_id;
    } else if (parent.type === 'block_id') {
      console.log('Fetching parent block ID:', parent.block_id);
      await sleep(1500); // Friendly delay
      const block = await notion.blocks.retrieve({ block_id: parent.block_id });
      parent = block.parent;
      console.log('Next parent type:', parent.type);
    } else if (parent.type === 'workspace') {
      console.log('Reached workspace root.');
      return null;
    } else {
      console.log('Unknown parent type:', parent.type);
      return null;
    }
  }
}

async function run() {
  const dbId = '371d0aaf19d081c59b14fbc0c52b0040'; // Comics
  console.log(`Resolving grandparent for Comics Database: ${dbId}`);
  try {
    const db = await notion.databases.retrieve({ database_id: dbId });
    const pageId = await getParentPageId(db.parent);
    console.log(`\nGrandparent Page ID found: ${pageId}`);
    if (pageId) {
      const page = await notion.pages.retrieve({ page_id: pageId });
      const title = page.properties?.title?.title?.[0]?.plain_text ||
                    page.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
      console.log(`Page Title: "${title}" | URL: ${page.url}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
