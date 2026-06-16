const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TARGET_ID = '372d0aaf-19d0-809a-b9af-ec501c2f56a7';
const notion = new Client({ auth: NOTION_TOKEN });

async function inspectTarget() {
  console.log(`Inspecting page or database: ${TARGET_ID}...`);
  try {
    // 1. Try to retrieve as a database
    try {
      const db = await notion.databases.retrieve({ database_id: TARGET_ID });
      console.log(`Type: Database`);
      console.log(`Title: "${db.title?.[0]?.plain_text || 'Untitled'}"`);
      console.log('Properties:', Object.keys(db.properties));
    } catch (_) {
      // 2. Try to retrieve as a page
      const page = await notion.pages.retrieve({ page_id: TARGET_ID });
      console.log(`Type: Page`);
      console.log(`Title: "${page.properties?.title?.title?.[0]?.plain_text || page.properties?.Name?.title?.[0]?.plain_text || 'Untitled'}"`);
    }

    // 3. Inspect children blocks
    const res = await notion.blocks.children.list({ block_id: TARGET_ID });
    console.log(`\n--- Inside Blocks (${res.results.length} blocks found) ---`);
    for (let i = 0; i < res.results.length; i++) {
      const b = res.results[i];
      let text = '';
      if (b[b.type]?.rich_text) {
        text = b[b.type].rich_text.map(t => t.plain_text).join('');
      }
      console.log(`[${i}] ${b.type} (ID: ${b.id}): "${text.substring(0, 100)}"`);
      if (b.has_children) {
        const children = await notion.blocks.children.list({ block_id: b.id });
        console.log(`     ↳ Children:`);
        for (const c of children.results) {
          let cText = '';
          if (c[c.type]?.rich_text) {
            cText = c[c.type].rich_text.map(t => t.plain_text).join('');
          }
          console.log(`       - [${c.type}] (ID: ${c.id}): "${cText.substring(0, 80)}"`);
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectTarget();
