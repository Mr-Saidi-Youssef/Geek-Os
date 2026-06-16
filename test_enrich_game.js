/**
 * test_enrich_game.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests Games template-copy enrichment on ONE specific game.
 * Reads YOUR actual "New Game" template from Notion, queries your database for
 * a target game (e.g., "The Witcher 3" or "Elden Ring"), fetches its YouTube trailer,
 * and populates the card in-place.
 *
 * Usage:  node test_enrich_game.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Client } = require('@notionhq/client');
const axios      = require('axios');
require('dotenv').config();

const DATABASE_ID             = process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf19d0815bb5d3d51ed587a7d1';
const TEMPLATE_SOURCE_PAGE_ID = process.env.NOTION_GAMES_TEMPLATE_ID || '370d0aaf19d08033b99bf17d506373fd';
const TARGET_TITLE_SEARCH     = "Witcher 3"; // Default game to test search on
const MAX_RETRIES             = 4;

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry(fn, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); }
    catch (err) {
      const is429 = err?.status === 429 || err?.code === 'rate_limited';
      if ((is429 || err?.status >= 500) && attempt < retries) {
        let waitSec = Math.pow(2, attempt + 1) * 2;
        try {
          const ra = err?.headers?.get?.('retry-after') || err?.headers?.['retry-after']?.[0];
          if (ra) waitSec = parseInt(ra, 10) + 5;
        } catch (_) {}
        console.log(`  ⏳ Rate limited — waiting ${waitSec}s...`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
}

async function getYoutubeTrailer(title, year) {
  try {
    const q = encodeURIComponent(`${title} ${year || ''} official game trailer`);
    const r = await axios.get(`https://www.youtube.com/results?search_query=${q}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 7000
    });
    const m = r.data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
  } catch (_) {}
  return null;
}

function cleanBlock(block) {
  const c = { object: 'block', type: block.type, [block.type]: { ...block[block.type] } };
  delete c[block.type].has_children;
  if (c[block.type].icon === null) delete c[block.type].icon;
  return c;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🧪  GAMES TEMPLATE-COPY TEST`);
  console.log(`${'═'.repeat(60)}\n`);

  if (!TEMPLATE_SOURCE_PAGE_ID) {
    console.error('❌ Error: NOTION_GAMES_TEMPLATE_ID is not configured in .env file!');
    process.exit(1);
  }

  // 1. Load template details and blocks
  console.log(`[1/6] Loading your "New Game" template from Notion...`);
  const pageDetails = await withRetry(() =>
    notion.pages.retrieve({ page_id: TEMPLATE_SOURCE_PAGE_ID })
  );
  const templateIcon = pageDetails.icon;

  const templateRes = await withRetry(() =>
    notion.blocks.children.list({ block_id: TEMPLATE_SOURCE_PAGE_ID })
  );
  const topBlocks = templateRes.results;
  console.log(`      ✓ Loaded ${topBlocks.length} template blocks.`);

  // Load children of blocks that have them
  const childrenMap = {};
  for (const block of topBlocks) {
    if (block.has_children && block.type !== 'child_database') {
      const cr = await withRetry(() => notion.blocks.children.list({ block_id: block.id }));
      childrenMap[block.id] = cr.results;
      console.log(`      ✓ Loaded ${cr.results.length} children for "${block.type}" block.`);
    }
  }

  // 2. Query Games Database for a target page
  console.log(`\n[2/6] Querying Games database for "${TARGET_TITLE_SEARCH}"...`);
  const queryRes = await withRetry(() =>
    notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'Title',
        title: {
          contains: TARGET_TITLE_SEARCH
        }
      },
      page_size: 1
    })
  );

  if (queryRes.results.length === 0) {
    console.error(`❌ Error: No games containing "${TARGET_TITLE_SEARCH}" found in database!`);
    console.log('   Please make sure your games database is seeded or try a different title.');
    process.exit(1);
  }

  const targetPage = queryRes.results[0];
  const targetPageId = targetPage.id;
  const gameTitle = targetPage.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
  const developer = targetPage.properties.Developer?.rich_text?.map(t => t.plain_text).join('') || 'N/A';
  const publisher = targetPage.properties.Publisher?.rich_text?.map(t => t.plain_text).join('') || 'N/A';
  const releaseYear = targetPage.properties.ReleaseYear?.number || '';
  const synopsis = targetPage.properties.Synopsis?.rich_text?.map(t => t.plain_text).join('') || '';

  console.log(`      ✓ Found Target Card: "${gameTitle}"`);
  console.log(`        Developer: ${developer} | Release: ${releaseYear}`);

  // 3. YouTube trailer
  console.log(`\n[3/6] Searching YouTube for trailer...`);
  const trailerUrl = await getYoutubeTrailer(gameTitle, releaseYear);
  console.log(trailerUrl ? `      ✓ Trailer URL: ${trailerUrl}` : `      ⚠️ No trailer found.`);

  // 4. Clear existing page blocks on target page (for clean re-run)
  console.log(`\n[4/6] Clearing any existing blocks on target page...`);
  const existingRes = await withRetry(() => notion.blocks.children.list({ block_id: targetPageId }));
  for (const block of existingRes.results) {
    await withRetry(() => notion.blocks.delete({ block_id: block.id }));
  }
  console.log(`      ✓ Page cleared.`);

  // 5. Copy template to target page with data injected
  console.log(`\n[5/6] Copying your Games template to "${gameTitle}" page...`);

  for (const block of topBlocks) {
    if (block.type === 'child_database') continue;

    const newBlock = cleanBlock(block);

    // Synopsis callout (first callout with children)
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      if (!text.toLowerCase().includes('watched') && !text.toLowerCase().includes('played')) {
        const res = await withRetry(() => notion.blocks.children.append({
          block_id: targetPageId, children: [newBlock]
        }));
        const newCalloutId = res.results[0].id;

        const kids = (childrenMap[block.id] || []).map(child => {
          const c = cleanBlock(child);
          if (child.type === 'paragraph' && synopsis) {
            c.paragraph.rich_text = [{ type: 'text', text: { content: synopsis } }];
          }
          return c;
        });
        if (kids.length > 0) {
          await withRetry(() => notion.blocks.children.append({ block_id: newCalloutId, children: kids }));
        }
        console.log(`      ✓ Synopsis callout filled.`);
        continue;
      }
    }

    // My Review callout
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('watched') || text.toLowerCase().includes('played')) {
        const res = await withRetry(() => notion.blocks.children.append({
          block_id: targetPageId, children: [newBlock]
        }));
        const reviewId = res.results[0].id;
        const kids = (childrenMap[block.id] || []).map(c => cleanBlock(c));
        if (kids.length > 0) {
          await withRetry(() => notion.blocks.children.append({ block_id: reviewId, children: kids }));
        }
        console.log(`      ✓ My Review callout structure copied.`);
        continue;
      }
    }

    // Details/Specifications row (paragraph immediately following the "Informations" heading)
    if (block.type === 'paragraph') {
      const index = topBlocks.indexOf(block);
      if (index > 0 && topBlocks[index - 1].type === 'heading_2') {
        const prevText = topBlocks[index - 1].heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (prevText.toLowerCase().includes('information')) {
          newBlock.paragraph.rich_text = [
            { type: 'text', text: { content: 'Developer: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${developer}  |  ` } },
            { type: 'text', text: { content: 'Publisher: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${publisher}  |  ` } },
            { type: 'text', text: { content: 'Release: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${releaseYear || 'N/A'}` } }
          ];
          console.log(`      ✓ Specification details injected.`);
        }
      }
    }

    // Copy toggle blocks with their children
    if (block.has_children) {
      const headingRes = await withRetry(() => notion.blocks.children.append({
        block_id: targetPageId, children: [newBlock]
      }));
      const headingId = headingRes.results[0].id;

      const toggleChildren = (childrenMap[block.id] || []).map(c => cleanBlock(c));
      if (toggleChildren.length > 0) {
        await withRetry(() => notion.blocks.children.append({ block_id: headingId, children: toggleChildren }));
      }
      console.log(`      ✓ Copied "${block.type}" toggle with its children.`);
      continue;
    }

    // Trailer video
    if (block.type === 'video' && trailerUrl) {
      newBlock.video = { external: { url: trailerUrl } };
      console.log(`      ✓ Trailer video embedded.`);
    }

    await withRetry(() => notion.blocks.children.append({ block_id: targetPageId, children: [newBlock] }));
  }

  // 6. Update database properties (Cover & Icon)
  console.log(`\n[6/6] Setting database card properties...`);
  const updateParams = { page_id: targetPageId };
  if (templateIcon) updateParams.icon = templateIcon;

  await withRetry(() => notion.pages.update(updateParams));
  console.log(`      ✓ Properties + icon set.`);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅  SUCCESS — "${gameTitle}" enriched using your template!`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`   Page URL : https://www.notion.so/${targetPageId.replace(/-/g, '')}`);
  console.log(`   Trailer  : ${trailerUrl || 'none'}`);
  console.log(`${'═'.repeat(60)}\n`);
}

run().catch(err => console.error('❌ Fatal:', err.message));
