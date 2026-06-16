const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function run() {
  const page = await notion.pages.retrieve({ page_id: '372d0aaf-19d0-8188-b3bb-efd5ddd80947' });
  console.log('Manga Template Properties:', JSON.stringify(page.properties, null, 2));
}

run();
