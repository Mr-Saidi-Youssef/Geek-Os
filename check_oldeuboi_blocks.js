const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const TARGET_PAGE_ID = '36dd0aaf-19d0-81f5-b782-fc4ff99de443'; // Oldeuboi page id

async function test() {
  console.log('Fetching Oldeuboi block children...');
  try {
    const response = await notion.blocks.children.list({ block_id: TARGET_PAGE_ID });
    console.log(`Page has ${response.results.length} blocks:`);
    for (let i = 0; i < response.results.length; i++) {
      const b = response.results[i];
      console.log(`[${i}] TYPE=${b.type} | HAS_CHILDREN=${b.has_children}`);
    }
  } catch (error) {
    console.log('Error caught:', error.message);
  }
}

test();
