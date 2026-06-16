/**
 * inspect_template.js
 * Reads the full block structure of the "New Movie" template page
 * so we know exactly what to copy to each movie page.
 */
const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// The master template source page ID (from fill_existing_movie.js)
const TEMPLATE_PAGE_ID = '370d0aaf-19d0-80a1-bede-df457c930950';

async function inspect() {
  console.log('\n══════════════════════════════════════════');
  console.log('🔍  INSPECTING "NEW MOVIE" TEMPLATE PAGE');
  console.log('══════════════════════════════════════════\n');

  // Get top-level blocks
  const res = await notion.blocks.children.list({ block_id: TEMPLATE_PAGE_ID });
  const blocks = res.results;
  console.log(`Found ${blocks.length} top-level blocks:\n`);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    let preview = '';

    if (b[b.type]?.rich_text?.length > 0) {
      preview = b[b.type].rich_text.map(t => t.plain_text).join('');
    } else if (b.type === 'video') {
      preview = b.video?.external?.url || b.video?.file?.url || '(no url)';
    } else if (b.type === 'divider') {
      preview = '───────────';
    } else if (b.type === 'image') {
      preview = b.image?.external?.url || '(image)';
    }

    console.log(`  [${i}] type: "${b.type}"  |  id: ${b.id}`);
    if (preview) console.log(`       text: "${preview.substring(0, 80)}"`);
    if (b[b.type]?.color) console.log(`       color: ${b[b.type].color}`);
    if (b[b.type]?.has_children) console.log(`       ⤷ HAS CHILDREN`);
    console.log('');

    // If it has children, show them too
    if (b[b.type]?.has_children || b.has_children) {
      const childRes = await notion.blocks.children.list({ block_id: b.id });
      for (const child of childRes.results) {
        let childPreview = '';
        if (child[child.type]?.rich_text?.length > 0) {
          childPreview = child[child.type].rich_text.map(t => t.plain_text).join('');
        }
        console.log(`       ↳ [child] type: "${child.type}"  |  id: ${child.id}`);
        if (childPreview) console.log(`                text: "${childPreview.substring(0, 80)}"`);
        console.log('');
      }
    }
  }

  console.log('══════════════════════════════════════════\n');
}

inspect().catch(err => {
  console.error('Error:', err.message);
  console.log('\nTrying alternate template page ID...');
  // Try the other known template page
  const ALT_ID = '370d0aaf-19d0-81fd-9db2-f76f59f90302';
  console.log(`ALT: ${ALT_ID}`);
});
