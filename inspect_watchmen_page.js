const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PAGE_ID = '371d0aaf-19d0-8008-8c08-c9f95a2449f4';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run(retries = 3) {
  try {
    console.log(`Retrieving Watchmen page: ${PAGE_ID}...`);
    const page = await notion.pages.retrieve({ page_id: PAGE_ID });
    console.log('Page properties details:');
    for (const [key, value] of Object.entries(page.properties)) {
      console.log(`- ${key}: type=${value.type}`, JSON.stringify(value, null, 2));
    }
  } catch (error) {
    if (error.status === 429 && retries > 0) {
      console.warn('Rate limited. Waiting 5s before retry...');
      await sleep(5000);
      return run(retries - 1);
    }
    console.error('Error retrieving page details:', error);
  }
}

run();
