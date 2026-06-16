/**
 * find_template_source.js
 * Searches for the "New Movie" template in the database and inspects
 * the block structure of recently enriched pages to use as our copy source.
 */
const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';

// Oldeuboi page — we just enriched this successfully
const OLDEUBOI_PAGE_ID = '36dd0aaf-19d0-81f5-b782-fc4ff99de443';

async function inspectPage(pageId, label) {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`📄  ${label}`);
  console.log(`    ID: ${pageId}`);
  console.log(`${'─'.repeat(55)}`);

  const res = await notion.blocks.children.list({ block_id: pageId });
  const blocks = res.results;
  console.log(`    ${blocks.length} top-level blocks:\n`);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    let preview = '';
    if (b[b.type]?.rich_text?.length > 0) {
      preview = b[b.type].rich_text.map(t => t.plain_text).join('').substring(0, 70);
    } else if (b.type === 'video') {
      preview = b.video?.external?.url || '(video)';
    } else if (b.type === 'divider') {
      preview = '───';
    }
    const hasChildren = b.has_children || b[b.type]?.has_children;
    console.log(`    [${i}] ${b.type}${hasChildren ? ' [+children]' : ''} — "${preview}"`);

    if (hasChildren) {
      const childRes = await notion.blocks.children.list({ block_id: b.id });
      for (const c of childRes.results) {
        let cp = c[c.type]?.rich_text?.map(t => t.plain_text).join('').substring(0, 60) || '';
        console.log(`         ↳ ${c.type} — "${cp}"`);
      }
    }
  }
}

async function run() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('🔍  FINDING TEMPLATE SOURCE STRUCTURE');
  console.log('══════════════════════════════════════════════════════');

  // 1. Inspect Oldeuboi (recently enriched — shows current block structure)
  await inspectPage(OLDEUBOI_PAGE_ID, 'Oldeuboi (recently enriched — current structure)');

  // 2. Search database for pages that might be the template
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`🔍  Searching for "New Movie" template pages...`);
  const searchRes = await notion.search({
    query: 'New Movie',
    filter: { value: 'page', property: 'object' }
  });
  console.log(`    Found ${searchRes.results.length} results for "New Movie":`);
  for (const r of searchRes.results) {
    const title = r.properties?.title?.title?.map(t => t.plain_text).join('') ||
                  r.properties?.Name?.title?.map(t => t.plain_text).join('') || '(no title)';
    console.log(`    • "${title}" — ID: ${r.id}`);
  }

  console.log('\n══════════════════════════════════════════════════════\n');
}

run().catch(err => console.error('❌', err.message));
