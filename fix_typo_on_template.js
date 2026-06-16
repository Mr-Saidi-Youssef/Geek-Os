const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const BLOCK_ID = '371d0aaf-19d0-818a-bb2d-c17c6d9066a0';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function run() {
  try {
    // 1. Retrieve current block content to verify
    console.log(`Retrieving block ${BLOCK_ID}...`);
    const block = await notion.blocks.retrieve({ block_id: BLOCK_ID });
    console.log('Current block type:', block.type);
    console.log('Current block details:', JSON.stringify(block[block.type], null, 2));

    // 2. Update the block to "What i didn't like" with bold style matching the original
    console.log("Updating block content to \"What i didn't like\"...");
    await notion.blocks.update({
      block_id: BLOCK_ID,
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: { content: "What i didn't like" },
            annotations: {
              bold: true,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: 'default'
            }
          }
        ]
      }
    });
    console.log('Block successfully updated!');
  } catch (error) {
    console.error('Error updating block:', error);
  }
}

run();
