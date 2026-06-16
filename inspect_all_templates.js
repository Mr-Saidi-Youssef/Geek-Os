const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const templates = {
  Movies: '370d0aaf-19d0-8056-8747-df3959410e3f',
  Series: '370d0aaf-19d0-80da-ae71-d2b907a48250',
  Anime: '370d0aaf-19d0-80a1-bede-df457c930950',
  Comics: '372d0aaf-19d0-80b7-a8f5-dc7020ea2f21',
  Games: '370d0aaf-19d0-8033-b99b-f17d506373fd'
};

async function inspect(name, pageId) {
  console.log(`\n========================================`);
  console.log(`Template: "${name}" (${pageId})`);
  console.log(`========================================`);
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    console.log('Icon:', JSON.stringify(page.icon));
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    console.log(`Found ${blocks.results.length} blocks:`);
    for (let i = 0; i < blocks.results.length; i++) {
      const b = blocks.results[i];
      let text = '';
      if (b[b.type]?.rich_text) {
        text = b[b.type].rich_text.map(t => t.plain_text).join('');
      }
      console.log(`  [${i}] ${b.type} (ID: ${b.id}): "${text.substring(0, 80)}"`);
    }
  } catch (err) {
    console.error(`Error inspecting "${name}":`, err.message);
  }
}

async function run() {
  for (const [name, pageId] of Object.entries(templates)) {
    await inspect(name, pageId);
    await sleep(1000);
  }
}

run();
