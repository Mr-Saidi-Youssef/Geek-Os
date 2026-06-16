/**
 * enrich_all_games.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bulk enriches blank Games pages in Notion by duplicating your custom "New Game"
 * template block-by-block, injecting game synopsis metadata, verified YouTube
 * trailers, and specification details in-place.
 *
 * Concurrency: 2 pages at a time (safe for Notion API rate limits).
 * Throttling: Throttled with a 350ms delay and automated exponential backoff
 * on 429 Rate Limit responses.
 *
 * Usage:
 *   node enrich_all_games.js              ← enrich all blank games
 *   node enrich_all_games.js --reset      ← clear checkpoint and start fresh
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Client } = require('@notionhq/client');
const axios      = require('axios');
const fs         = require('fs');
const path       = require('path');
require('dotenv').config();

// ─── Configuration ────────────────────────────────────────────────────────────

const DATABASE_ID             = process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf19d0815bb5d3d51ed587a7d1';
const TEMPLATE_SOURCE_PAGE_ID = process.env.NOTION_GAMES_TEMPLATE_ID || ''; // Set in your .env
const CONCURRENT_PAGES        = 2;
const BATCH_DELAY_MS          = 350;
const MAX_RETRIES             = 5;
const CHECKPOINT_FILE         = path.join(__dirname, 'enrich_games_checkpoint.json');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DO_RESET = process.argv.includes('--reset');

// ─── Checkpoint ───────────────────────────────────────────────────────────────

function loadCheckpoint() {
  if (DO_RESET && fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log('🔄  Checkpoint cleared — starting fresh.\n');
  }
  if (!fs.existsSync(CHECKPOINT_FILE)) return { done: {}, enriched: 0, skipped: 0, failed: 0 };
  try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8')); }
  catch (_) { return { done: {}, enriched: 0, skipped: 0, failed: 0 }; }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry(fn, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429       = err?.status === 429 || err?.code === 'rate_limited';
      const isTransient = err?.status >= 500;
      if ((is429 || isTransient) && attempt < retries) {
        let waitSec = Math.pow(2, attempt + 1) * 2;
        try {
          const ra = err?.headers?.get?.('retry-after') || err?.headers?.['retry-after']?.[0];
          if (ra) waitSec = parseInt(ra, 10) + 5;
        } catch (_) {}
        console.log(`\n  ⏳ Rate limited — waiting ${waitSec}s (attempt ${attempt + 1}/${retries})...`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
}

function getPageTitle(page) {
  for (const [, v] of Object.entries(page.properties)) {
    if (v.type === 'title') return v.title.map(t => t.plain_text).join('').trim();
  }
  return '(Untitled)';
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
  const clean = {
    object: 'block',
    type:   block.type,
    [block.type]: { ...block[block.type] }
  };
  delete clean[block.type].has_children;
  if (clean[block.type].icon === null) delete clean[block.type].icon;
  return clean;
}

// ─── Load the template block structure from Notion ────────────────────────────

async function loadTemplateStructure() {
  console.log(`📋  Loading Games template structure and details from source page...`);
  const pageDetails = await withRetry(() =>
    notion.pages.retrieve({ page_id: TEMPLATE_SOURCE_PAGE_ID })
  );
  const templateIcon = pageDetails.icon;

  const res = await withRetry(() =>
    notion.blocks.children.list({ block_id: TEMPLATE_SOURCE_PAGE_ID })
  );
  const topBlocks = res.results;

  // Load children for blocks that have them (callout children, toggle lists, etc.)
  const childrenMap = {};
  for (const block of topBlocks) {
    if (block.has_children && block.type !== 'child_database') {
      const childRes = await withRetry(() =>
        notion.blocks.children.list({ block_id: block.id })
      );
      childrenMap[block.id] = childRes.results;
    }
  }

  console.log(`    ✓ Loaded ${topBlocks.length} template blocks.`);
  return { topBlocks, childrenMap, icon: templateIcon };
}

// ─── Enrich a single Game page ────────────────────────────────────────────────

async function enrichPage(page, templateStructure) {
  const rawTitle = getPageTitle(page);

  // 1. Skip if already has content
  const existing = await withRetry(() =>
    notion.blocks.children.list({ block_id: page.id, page_size: 1 })
  );
  if (existing.results.length > 0) {
    return { status: 'skipped', title: rawTitle };
  }

  // 2. Fetch properties already populated in database row (scraped from Metacritic CSV)
  const developer = page.properties.Developer?.rich_text?.map(t => t.plain_text).join('') || 'N/A';
  const publisher = page.properties.Publisher?.rich_text?.map(t => t.plain_text).join('') || 'N/A';
  const releaseYear = page.properties.ReleaseYear?.number || '';
  const synopsis = page.properties.Synopsis?.rich_text?.map(t => t.plain_text).join('') || '';

  // 3. YouTube trailer lookup
  const trailerUrl = await getYoutubeTrailer(rawTitle, releaseYear);

  // 4. Copy template blocks
  const { topBlocks, childrenMap } = templateStructure;

  for (const block of topBlocks) {
    if (block.type === 'child_database') continue;

    const newBlock = cleanBlock(block);

    // Synopsis callout (first callout that has children)
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      if (!text.toLowerCase().includes('watched') && !text.toLowerCase().includes('played')) {
        const calloutRes = await withRetry(() =>
          notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
        );
        const newCalloutId = calloutRes.results[0].id;

        const templateChildren = childrenMap[block.id] || [];
        const newChildren = templateChildren.map(child => {
          const c = cleanBlock(child);
          // Paragraph after the Synopsis heading gets the plot
          if (child.type === 'paragraph' && synopsis) {
            c.paragraph.rich_text = [{ type: 'text', text: { content: synopsis.substring(0, 2000) } }];
          }
          return c;
        });

        if (newChildren.length > 0) {
          await withRetry(() =>
            notion.blocks.children.append({ block_id: newCalloutId, children: newChildren })
          );
        }
        continue;
      }
    }

    // My Review callout
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('watched') || text.toLowerCase().includes('played')) {
        const reviewRes = await withRetry(() =>
          notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
        );
        const reviewCalloutId = reviewRes.results[0].id;

        const reviewChildren = (childrenMap[block.id] || []).map(child => cleanBlock(child));
        if (reviewChildren.length > 0) {
          await withRetry(() =>
            notion.blocks.children.append({ block_id: reviewCalloutId, children: reviewChildren })
          );
        }
        continue;
      }
    }

    // Dynamic Specs row (paragraph immediately following the "Informations" heading)
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
        }
      }
    }

    // Copy toggle blocks with their children (Achievements, Chapters, walkthrough logs)
    if (block.has_children) {
      // Create toggle heading block
      const headingRes = await withRetry(() =>
        notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
      );
      const headingId = headingRes.results[0].id;

      // Append all nested checklist/bullet items
      const toggleChildren = (childrenMap[block.id] || []).map(c => cleanBlock(c));
      if (toggleChildren.length > 0) {
        await withRetry(() =>
          notion.blocks.children.append({ block_id: headingId, children: toggleChildren })
        );
      }
      continue;
    }

    // Trailer video
    if (block.type === 'video' && trailerUrl) {
      newBlock.video = { external: { url: trailerUrl } };
    }

    await withRetry(() =>
      notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
    );
  }

  // 5. Update properties (Ensure icon matches template)
  const updateParams = { page_id: page.id };
  if (templateStructure.icon) updateParams.icon = templateStructure.icon;

  await withRetry(() => notion.pages.update(updateParams));

  return { status: 'enriched', title: rawTitle };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`🎮  BULK GAMES ENRICHMENT — Using Your Custom "New Game" Template`);
  console.log(`${'═'.repeat(62)}\n`);

  if (!TEMPLATE_SOURCE_PAGE_ID) {
    console.error('❌ Error: NOTION_GAMES_TEMPLATE_ID is not configured in your .env file!');
    console.error('   Please create a template under your Games database, copy its link,');
    console.error('   and add NOTION_GAMES_TEMPLATE_ID=your_id to .env first.\n');
    process.exit(1);
  }

  const cp = loadCheckpoint();
  console.log(`📂  Checkpoint: ${Object.keys(cp.done).length} games from previous run.\n`);

  const templateStructure = await loadTemplateStructure();
  console.log('');

  // Paginate through the Games database
  let allPages = [], cursor;
  process.stdout.write('Fetching all Games...');
  do {
    const res = await withRetry(() => notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100
    }));
    allPages = allPages.concat(res.results);
    cursor   = res.has_more ? res.next_cursor : undefined;
    process.stdout.write(` ${allPages.length}`);
  } while (cursor);
  console.log(` total.\n`);

  const pending = allPages.filter(p => !cp.done[p.id]);
  console.log(`Pending: ${pending.length} pages\n${'─'.repeat(62)}\n`);

  let done = 0;
  const startTime = Date.now();

  for (let i = 0; i < pending.length; i += CONCURRENT_PAGES) {
    const batch = pending.slice(i, i + CONCURRENT_PAGES);

    const results = await Promise.allSettled(
      batch.map(page => enrichPage(page, templateStructure))
    );

    for (let j = 0; j < results.length; j++) {
      const page   = batch[j];
      const result = results[j];
      done++;

      if (result.status === 'fulfilled') {
        const { status, title } = result.value;
        cp.done[page.id] = status;
        if (status === 'enriched') {
          cp.enriched++;
          console.log(`  ✅ [${done}] ${title}`);
        } else {
          cp.skipped++;
          console.log(`  ⏭️  [${done}] ${title}`);
        }
      } else {
        cp.done[page.id] = 'failed';
        cp.failed = (cp.failed || 0) + 1;
        console.log(`  ❌ [${done}] ${getPageTitle(page)} — ${result.reason?.message || 'error'}`);
      }
    }

    saveCheckpoint(cp);

    const elapsed   = (Date.now() - startTime) / 1000;
    const rate      = done / elapsed;
    const remaining = pending.length - done;
    const etaSec    = rate > 0 ? Math.round(remaining / rate) : 0;
    const eta       = `${Math.floor(etaSec / 60)}m ${etaSec % 60}s`;
    process.stdout.write(`  Progress: ${done}/${pending.length} | ✅ ${cp.enriched} | ⏭️ ${cp.skipped} | ❌ ${cp.failed || 0} | ETA: ${eta}\n`);

    if (i + CONCURRENT_PAGES < pending.length) await sleep(BATCH_DELAY_MS);
  }

  const totalSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`✅  COMPLETE — ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log(`   Enriched: ${cp.enriched} | Skipped: ${cp.skipped} | Failed: ${cp.failed || 0}`);
  console.log(`${'═'.repeat(62)}\n`);
}

run();
