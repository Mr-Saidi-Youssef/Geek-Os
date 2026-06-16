const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function inspect(label, pageId) {
  console.log(`\n========================================`);
  console.log(`Inspecting page: "${label}" (${pageId})`);
  console.log(`========================================`);
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    console.log('Title Property:', JSON.stringify(page.properties.Title || page.properties.Name));
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
      if (b.has_children) {
        try {
          const children = await notion.blocks.children.list({ block_id: b.id });
          for (const child of children.results) {
            let ct = child[child.type]?.rich_text?.map(t => t.plain_text).join('') || '';
            console.log(`     ↳ ${child.type}: "${ct.substring(0, 70)}"`);
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.error(`Error inspecting "${label}":`, err.message);
  }
}

async function run() {
  await inspect('Manga Monster', '374d0aaf-19d0-8189-8ef9-c0003befff44');
  await inspect('Book The Hobbit', '374d0aaf-19d0-81f7-bcd7-dcdfd9c043a4');
  await inspect('TV Arcane', '374d0aaf-19d0-812f-a947-ead5eb448c1c');
}

run();
