const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function run() {
  try {
    const actPage = await notion.pages.retrieve({ page_id: '374d0aaf-19d0-8189-8ef9-c0003befff44' });
    console.log('Manga Page Parent:', JSON.stringify(actPage.parent));
    console.log('Manga DB ID from .env:', process.env.NOTION_MANGA_DATABASE_ID);
  } catch (err) {
    console.error(err.message);
  }
}

run();
