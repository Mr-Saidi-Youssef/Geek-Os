const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function inspect(label, pageId) {
  console.log(`\n========================================`);
  console.log(`Properties for: ${label} (${pageId})`);
  console.log(`========================================`);
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    for (const [name, val] of Object.entries(page.properties)) {
      console.log(`Property "${name}" (type=${val.type}):`);
      console.log(`  Value: ${JSON.stringify(val[val.type])}`);
    }
  } catch (err) {
    console.error(err.message);
  }
}

async function run() {
  await inspect('Manga Monster', '374d0aaf-19d0-8189-8ef9-c0003befff44');
  await inspect('Book The Hobbit', '374d0aaf-19d0-81f7-bcd7-dcdfd9c043a4');
}

run();
