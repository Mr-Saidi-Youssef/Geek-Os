const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TEMPLATE_ID = '371d0aaf19d080088c08c9f95a2449f4';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function start() {
  console.log(`Fetching template page details for ID: ${TEMPLATE_ID}`);
  try {
    const page = await notion.pages.retrieve({ page_id: TEMPLATE_ID });
    console.log('Icon:', JSON.stringify(page.icon, null, 2));
    console.log('Cover:', JSON.stringify(page.cover, null, 2));
    console.log('Properties:', JSON.stringify(page.properties, null, 2));
  } catch (error) {
    console.error('Error fetching template details:', error);
  }
}

start();
