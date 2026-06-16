const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const PAGE_ID = '370d0aaf-19d0-80b5-945e-df3f03ca5f51';
const CALLOUT_BLOCK_ID = '370d0aaf-19d0-8057-9f3b-e8108493bc47';
const NESTED_PARAGRAPH_ID = '370d0aaf-19d0-804d-bd4c-dce25389671d';

const PLOT_TEXT = "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a CEO, but his tragic past may doom the project and his team to disaster.";

async function run() {
  try {
    console.log('1. Clearing main Callout text...');
    await notion.blocks.update({
      block_id: CALLOUT_BLOCK_ID,
      callout: {
        rich_text: [] // Clear main callout text
      }
    });

    console.log('2. Updating nested paragraph with synopsis plot...');
    await notion.blocks.update({
      block_id: NESTED_PARAGRAPH_ID,
      paragraph: {
        rich_text: [{ type: 'text', text: { content: PLOT_TEXT } }]
      }
    });

    console.log('Success! Synopsis fixed.');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

run();
