const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function inspect(label, pageId) {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    console.log(`\nExpected page "${label}" (${pageId}):`);
    console.log(`  Parent:`, JSON.stringify(page.parent));
  } catch (err) {
    console.error(err.message);
  }
}

async function run() {
  await inspect('Anime', '36dd0aaf-19d0-8111-873e-eadc67b91b57');
  await inspect('Manga', '370d0aaf-19d0-8187-ae92-e40b5507488d');
  await inspect('Book', '367d0aaf-19d0-81b0-a17f-f50689675151');
  await inspect('Game', '36fd0aaf-19d0-8147-82b0-dd54a68ff63f');
}

run();
