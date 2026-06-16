/**
 * enrich_all_manga.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Bulk enriches blank Manga pages in Notion by copying your custom "New Manga"
 * template block-by-block, injecting synopsis plot metadata, volumes/chapters count,
 * authors list, and genre tags in-place.
 *
 * Powered by keyless Jikan API (MyAnimeList)
 * Developed for Byronotion Watchlist Tracker
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Client } = require('@notionhq/client');
const axios      = require('axios');
const fs         = require('fs');
const path       = require('path');
require('dotenv').config();

// ─── Configuration ────────────────────────────────────────────────────────────

const DATABASE_ID             = '370d0aaf-19d0-8121-a36f-f3dfcc914532'; // Your Manga Database
const TEMPLATE_SOURCE_PAGE_ID = '372d0aaf-19d0-809a-b9af-ec501c2f56a7'; // Your New Manga Template
const CONCURRENT_PAGES        = 2;
const BATCH_DELAY_MS          = 1200; // respect Jikan rate limits
const MAX_RETRIES             = 5;
const CHECKPOINT_FILE         = path.join(__dirname, 'enrich_manga_checkpoint.json');

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

function buildPosterUrl(raw) {
  if (!raw || raw === 'N/A') return null;
  if (raw.includes('myanimelist.net')) {
    return raw;
  }
  return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}`;
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
  console.log(`📋  Loading Manga template structure and details from source page...`);
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

// ─── Resolve Clean Manga Title ─────────────────────────────────────────────────

function resolveMangaTitle(rawTitle) {
  return rawTitle.replace(/^[\p{Emoji}\s]+/u, '').trim();
}

// ─── Enrich a single Manga page ────────────────────────────────────────────────

async function enrichPage(page, templateStructure) {
  const rawTitle = getPageTitle(page);

  // 1. Skip if already has content blocks
  const existing = await withRetry(() =>
    notion.blocks.children.list({ block_id: page.id, page_size: 1 })
  );
  if (existing.results.length > 0) {
    return { status: 'skipped', title: rawTitle };
  }

  const cleanTitle = resolveMangaTitle(rawTitle);

  // 2. Fetch Manga details from MyAnimeList (Jikan API v4)
  let malInfo = null;
  try {
    const searchRes = await axios.get(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(cleanTitle)}&limit=1`);
    if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
      const d = searchRes.data.data[0];
      malInfo = {
        malId: d.mal_id,
        title: d.title_english || d.title,
        plot: d.synopsis,
        score: d.score,
        chapters: d.chapters,
        volumes: d.volumes,
        publishingStatus: d.status,
        authors: d.authors?.map(a => a.name.replace(/, /g, ' ')).join(', ') || 'Unknown',
        genres: d.genres?.map(g => g.name) || [],
        poster: d.images?.jpg?.large_image_url || d.images?.jpg?.image_url || null,
        url: d.url
      };
    }
  } catch (err) {
    console.log(`    ⚠️ Failed Jikan lookups for "${cleanTitle}":`, err.message);
  }

  if (!malInfo) {
    // Deterministic fallback if MAL doesn't find it
    malInfo = {
      malId: null,
      title: rawTitle,
      plot: `A popular manga series cataloged in your tracker collection.`,
      score: null,
      chapters: null,
      volumes: null,
      publishingStatus: 'Finished',
      authors: 'Unknown',
      genres: [],
      poster: null,
      url: null
    };
  }

  const posterUrl = buildPosterUrl(malInfo.poster);
  const totalVolumes = malInfo.volumes || 1;
  const totalChapters = malInfo.chapters || 10;

  // 3. Copy template blocks
  const { topBlocks, childrenMap } = templateStructure;

  for (const block of topBlocks) {
    if (block.type === 'child_database') continue;

    // Skip the "My Review" section completely
    if (block.type === 'heading_2') {
      const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('review')) {
        break; // Stop appending blocks since the review section is at the end
      }
    }
    if (block.type === 'divider') {
      const index = topBlocks.indexOf(block);
      if (index < topBlocks.length - 1 && topBlocks[index + 1].type === 'heading_2') {
        const nextText = topBlocks[index + 1].heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (nextText.toLowerCase().includes('review')) {
          continue; // skip the divider before the review section
        }
      }
    }

    const newBlock = cleanBlock(block);

    // Synopsis callout
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      if (!text.toLowerCase().includes('like') && !text.toLowerCase().includes('verdict')) {
        const calloutRes = await withRetry(() =>
          notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
        );
        const newCalloutId = calloutRes.results[0].id;

        const templateChildren = childrenMap[block.id] || [];
        const newChildren = templateChildren.map(child => {
          const c = cleanBlock(child);
          // Insert plot into synopsis paragraph
          if (child.type === 'paragraph' && malInfo.plot) {
            c.paragraph.rich_text = [{ type: 'text', text: { content: malInfo.plot.substring(0, 2000) } }];
          }
          return c;
        });

        if (newChildren.length > 0) {
          await withRetry(() =>
            notion.blocks.children.append({ block_id: newCalloutId, children: newChildren })
          );
        }
        await sleep(350);
        continue;
      }
    }

    // My Review callout
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('like') || text.toLowerCase().includes('verdict')) {
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
        await sleep(350);
        continue;
      }
    }

    // Specification details paragraph under Informations heading
    if (block.type === 'paragraph') {
      const index = topBlocks.indexOf(block);
      if (index > 0 && topBlocks[index - 1].type === 'heading_2') {
        const prevText = topBlocks[index - 1].heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (prevText.toLowerCase().includes('information')) {
          newBlock.paragraph.rich_text = [
            { type: 'text', text: { content: 'Author: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${malInfo.authors}  |  ` } },
            { type: 'text', text: { content: 'Volumes: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${malInfo.volumes || 'N/A'}  |  ` } },
            { type: 'text', text: { content: 'Chapters: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${malInfo.chapters || 'N/A'}  |  ` } },
            { type: 'text', text: { content: 'Status: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${malInfo.publishingStatus || 'N/A'}` } }
          ];
        }
      }
    }

    // Volumes toggle heading
    if (block.type === 'heading_2' && block.has_children) {
      const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('volume')) {
        const headingRes = await withRetry(() =>
          notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
        );
        const headingId = headingRes.results[0].id;

        const volumeChildren = [];
        for (let v = 1; v <= Math.min(totalVolumes, 100); v++) {
          volumeChildren.push({
            object: 'block',
            type: 'to_do',
            to_do: {
              rich_text: [{ type: 'text', text: { content: `Volume ${v}` } }],
              checked: false
            }
          });
        }

        if (volumeChildren.length > 0) {
          await withRetry(() =>
            notion.blocks.children.append({ block_id: headingId, children: volumeChildren })
          );
        }
        await sleep(350);
        continue;
      }
    }

    // Chapters/Single Issues toggle heading
    if (block.type === 'heading_2' && block.has_children) {
      const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('single') || text.toLowerCase().includes('chapter')) {
        const headingRes = await withRetry(() =>
          notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
        );
        const headingId = headingRes.results[0].id;

        const chapterChildren = [];
        const maxChapters = malInfo.volumes ? Math.min(totalChapters, 60) : 40; // cap to avoid block flood
        for (let ch = 1; ch <= maxChapters; ch++) {
          chapterChildren.push({
            object: 'block',
            type: 'to_do',
            to_do: {
              rich_text: [{ type: 'text', text: { content: `Chapter ${ch}` } }],
              checked: false
            }
          });
        }

        for (let offset = 0; offset < chapterChildren.length; offset += 50) {
          const chunk = chapterChildren.slice(offset, offset + 50);
          await withRetry(() =>
            notion.blocks.children.append({ block_id: headingId, children: chunk })
          );
          await sleep(350);
        }
        continue;
      }
    }

    // Default append
    if (block.has_children) {
      const headingRes = await withRetry(() =>
        notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
      );
      const headingId = headingRes.results[0].id;

      const childrenBlocks = (childrenMap[block.id] || []).map(c => cleanBlock(c));
      if (childrenBlocks.length > 0) {
        await withRetry(() =>
          notion.blocks.children.append({ block_id: headingId, children: childrenBlocks })
        );
      }
    } else {
      await withRetry(() =>
        notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
      );
    }
    await sleep(350);
  }

  // 4. Update Database Row Properties dynamically (detecting schema columns)
  const db = await withRetry(() => notion.databases.retrieve({ database_id: DATABASE_ID }));
  const existingProps = Object.keys(db.properties);

  const props = {};
  if (existingProps.includes('MAL ID')) props['MAL ID'] = { number: malInfo.malId };
  if (existingProps.includes('Volumes')) props['Volumes'] = { number: malInfo.volumes };
  if (existingProps.includes('Chapters')) props['Chapters'] = { number: malInfo.chapters };
  if (existingProps.includes('MAL Score')) props['MAL Score'] = { number: malInfo.score };
  if (existingProps.includes('MAL URL')) props['MAL URL'] = { url: malInfo.url || null };
  if (existingProps.includes('Synopsis')) props['Synopsis'] = { rich_text: [{ text: { content: (malInfo.plot || '').substring(0, 1900) } }] };
  
  if (existingProps.includes('Authors')) {
    if (db.properties['Authors'].type === 'rich_text') {
      props['Authors'] = { rich_text: [{ text: { content: malInfo.authors } }] };
    } else if (db.properties['Authors'].type === 'multi_select') {
      props['Authors'] = { multi_select: malInfo.authors.split(',').map(a => ({ name: a.trim() })) };
    }
  }

  if (existingProps.includes('Genres') && malInfo.genres.length > 0) {
    props['Genres'] = { multi_select: malInfo.genres.map(g => ({ name: g })) };
  }

  const updateParams = { page_id: page.id, properties: props };
  if (posterUrl && (existingProps.includes('Cover Image') || existingProps.includes('Cover'))) {
    const coverPropName = existingProps.includes('Cover Image') ? 'Cover Image' : 'Cover';
    updateParams.properties[coverPropName] = {
      files: [{ name: 'Cover Image', type: 'external', external: { url: posterUrl } }]
    };
  }

  // Set Page cover and icon
  if (posterUrl) updateParams.cover = { type: 'external', external: { url: posterUrl } };
  if (templateStructure.icon) updateParams.icon = templateStructure.icon;

  await withRetry(() => notion.pages.update(updateParams));

  return { status: 'enriched', title: malInfo.title };
}

// ─── Main Execution Sweep ─────────────────────────────────────────────────────

async function run() {
  console.log(`\n======================================================`);
  console.log(`🚀  STARTING BULK MANGA LIBRARY ENRICHMENT PIPELINE`);
  console.log(`======================================================\n`);

  const cp = loadCheckpoint();
  console.log(`📂  Checkpoint: ${Object.keys(cp.done).length} manga items processed in previous run.\n`);

  const templateStructure = await loadTemplateStructure();
  console.log('');

  // Fetch all pages in Manga database
  let allPages = [], cursor;
  process.stdout.write('Fetching all Manga pages from Notion...');
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

  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
  let pending = allPages.filter(p => !cp.done[p.id]);
  if (limit) {
    pending = pending.slice(0, limit);
    console.log(`⏳ Limiting run to ${limit} pending pages for verification.`);
  }
  console.log(`Pending: ${pending.length} pages to enrich\n${'-'.repeat(54)}\n`);

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
  console.log(`\n======================================================`);
  console.log(`🎉  COMPLETE — ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log(`   Enriched: ${cp.enriched} | Skipped: ${cp.skipped} | Failed: ${cp.failed}`);
  console.log(`======================================================\n`);
}

run();
