const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const dashboards = {
  Series: '36bd0aaf-19d0-80e9-8250-c93e3d89b1fd',
  Anime: '36bd0aaf-19d0-80b3-b782-cd5fc51a4265',
  Manga: '36bd0aaf-19d0-808c-a81e-c4247c9d32c8',
  Comics: '371d0aaf-19d0-80b3-9948-e6501769d458',
  Games: '36bd0aaf-19d0-8039-b1df-fb867c316ea8',
  Books: '367d0aaf-19d0-80ae-a661-cb90ecc00e21'
};

async function inspect(name, pageId) {
  console.log(`\n========================================`);
  console.log(`Dashboard: "${name}" (${pageId})`);
  console.log(`========================================`);
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    console.log('Icon:', JSON.stringify(page.icon));
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    console.log(`Found ${blocks.results.length} top-level blocks:`);
    for (let i = 0; i < blocks.results.length; i++) {
      const b = blocks.results[i];
      let text = '';
      if (b[b.type]?.rich_text) {
        text = b[b.type].rich_text.map(t => t.plain_text).join('');
      } else if (b.type === 'child_database') {
        text = `Database: "${b.child_database.title}"`;
      }
      console.log(`  [${i}] ${b.type} (ID: ${b.id}): "${text.substring(0, 100)}"`);
    }
  } catch (err) {
    console.error(`Error inspecting "${name}":`, err.message);
  }
}

async function run() {
  for (const [name, pageId] of Object.entries(dashboards)) {
    await inspect(name, pageId);
    await sleep(1000);
  }
}

run();
