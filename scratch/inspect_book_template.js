const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

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
    console.error(`Error inspecting "${name}":`, err.message);
  }
}

inspect('New Book', '372d0aaf-19d0-81e4-9db2-e1837e15461f');
