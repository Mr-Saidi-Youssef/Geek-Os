const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const PAGE_ID = '36ed0aaf-19d0-8188-bd15-da41113c665f'; // Breaking Bad page id

async function inspect() {
  console.log('Inspecting Breaking Bad page blocks...');
  try {
    const res = await notion.blocks.children.list({ block_id: PAGE_ID });
    console.log(`Found ${res.results.length} blocks on Breaking Bad:`);
    for (let i = 0; i < res.results.length; i++) {
      const b = res.results[i];
      let text = '';
      if (b[b.type]?.rich_text) {
        text = b[b.type].rich_text.map(t => t.plain_text).join('');
      }
      console.log(`[${i}] type: "${b.type}" | has_children: ${b.has_children} | text: "${text.substring(0, 50)}"`);
      if (b.has_children) {
        const children = await notion.blocks.children.list({ block_id: b.id });
        for (const c of children.results) {
          let cText = '';
          if (c[c.type]?.rich_text) {
            cText = c[c.type].rich_text.map(t => t.plain_text).join('');
          }
          console.log(`   ↳ child type: "${c.type}" | text: "${cText.substring(0, 50)}"`);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

inspect();
