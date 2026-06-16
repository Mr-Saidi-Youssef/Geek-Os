/**
 * enrich_all_anime.js  (v1 — copies YOUR exact Notion Anime template)
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses your "New Anime" template page as the template source.
 *
 * For every blank Anime page it will:
 *   1. Read the template blocks live from the source page
 *   2. Copy the entire structure to the target Anime page
 *   3. Fetch real details and characters/episodes from Jikan API (MyAnimeList)
 *   4. Construct beautiful, nested checklists and voice actor bullets
 *   5. Set the high-res MAL poster as the page cover
 *   6. Update database properties (Studio, Total Episodes, MAL Score, Synopsis,
 *      Genres, MAL URL, cover, icon)
 *
 * KEY FEATURES:
 *   • Template is read LIVE from your Notion page — matches it 100%
 *   • Auto-generates the real Anime characters & episode checklists dynamically
 *   • Concurrency: 2 pages at a time (safe for Notion rate limits)
 *   • withRetry(): auto-waits on 429 errors using the retry-after header
 *   • Checkpoint file: resume if interrupted (Ctrl+C safe)
 *
 * Usage:
 *   node enrich_all_anime.js              ← enrich all blank anime
 *   node enrich_all_anime.js --reset      ← clear checkpoint and restart
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Client } = require('@notionhq/client');
const axios      = require('axios');
const fs         = require('fs');
const path       = require('path');
require('dotenv').config();

// ─── Configuration ────────────────────────────────────────────────────────────

const DATABASE_ID      = process.env.NOTION_DATABASE_ID || '36dd0aaf19d0800792e7dca0434c570c';
const CONCURRENT_PAGES = 2;
const BATCH_DELAY_MS   = 1200; // slightly longer to respect Jikan's strict rate limits
const MAX_RETRIES      = 5;
const CHECKPOINT_FILE  = path.join(__dirname, 'enrich_anime_checkpoint.json');

const TEMPLATE_SOURCE_PAGE_ID = '370d0aaf-19d0-80a1-bede-df457c930950'; // Your New Anime template

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

async function getYoutubeTrailer(title) {
  try {
    const q = encodeURIComponent(`${title} official trailer`);
    const r = await axios.get(`https://www.youtube.com/results?search_query=${q}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 7000
    });
    const m = r.data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
  } catch (_) {}
  return null;
}

function buildPosterUrl(raw) {
  if (!raw || raw === 'N/A') return null;
  if (raw.includes('myanimelist.net')) {
    return raw;
  }
  return raw;
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
  console.log(`📋  Loading Anime template structure and details from source page...`);
  const pageDetails = await withRetry(() =>
    notion.pages.retrieve({ page_id: TEMPLATE_SOURCE_PAGE_ID })
  );
  const templateIcon = pageDetails.icon;

  const res = await withRetry(() =>
    notion.blocks.children.list({ block_id: TEMPLATE_SOURCE_PAGE_ID })
  );
  const topBlocks = res.results;

  // Load children for blocks that have them (callout children, etc.)
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

// ─── Resolve Title overrides if any ───────────────────────────────────────────

const ANIME_OVERRIDES = {
  'little witch academia (tv)': 'Little Witch Academia',
  'wind: a breath of heart (tv)': 'Wind: A Breath of Heart',
  'area 88 (tv)': 'Area 88',
  'pucca (tv)': 'Pucca',
  'pucca (tv) 2nd season': 'Pucca',
  'sakura wars tv': 'Sakura Wars',
  'kemurikusa (tv)': 'Kemurikusa',
  'black jack (tv)': 'Black Jack'
};

function resolveAnimeTitle(rawTitle) {
  const clean = rawTitle.replace(/^[\p{Emoji}\s]+/u, '').trim();
  return ANIME_OVERRIDES[clean.toLowerCase()] || clean;
}

// ─── Enrich a single Anime page ───────────────────────────────────────────────

async function enrichPage(page, templateStructure) {
  const rawTitle = getPageTitle(page);

  // 1. Skip if already has content
  const existing = await withRetry(() =>
    notion.blocks.children.list({ block_id: page.id, page_size: 1 })
  );
  if (existing.results.length > 0) {
    return { status: 'skipped', title: rawTitle };
  }

  const cleanTitle = resolveAnimeTitle(rawTitle);

  // 2. Fetch Jikan details (Search -> Info -> Characters -> Episodes)
  let malId = null;
  let animeInfo = {};
  let malCharacters = [];
  let malEpisodes = [];

  // A. Search anime
  try {
    const searchRes = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanTitle)}&limit=1`);
    if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
      const d = searchRes.data.data[0];
      malId = d.mal_id;
      animeInfo = {
        title: d.title_english || d.title,
        plot: d.synopsis,
        score: d.score,
        format: d.type,
        totalEpisodes: d.episodes,
        airedStr: d.aired?.string || 'N/A',
        studio: d.studios?.[0]?.name || 'N/A',
        poster: d.images?.jpg?.large_image_url || d.images?.jpg?.image_url,
        genres: d.genres?.map(g => g.name) || [],
        url: d.url,
        trailer: d.trailer?.url || null
      };
    }
  } catch (_) {}

  // If search failed, try fallback
  if (!malId) {
    return { status: 'failed_api', title: rawTitle };
  }

  // Respect Jikan rate limit
  await sleep(1200);

  // B. Characters
  try {
    const charRes = await axios.get(`https://api.jikan.moe/v4/anime/${malId}/characters`);
    if (charRes.data && charRes.data.data) {
      const mainChars = charRes.data.data.filter(c => c.role === 'Main' || c.role === 'Supporting').slice(0, 6);
      malCharacters = mainChars.map(c => {
        const jaVA = c.voice_actors?.find(va => va.language === 'Japanese');
        return {
          name: c.character.name.replace(/, /g, ' '),
          va: jaVA ? jaVA.person.name.replace(/, /g, ' ') : 'N/A'
        };
      });
    }
  } catch (_) {}

  await sleep(1200);

  // C. Episodes
  try {
    const epRes = await axios.get(`https://api.jikan.moe/v4/anime/${malId}/episodes`);
    if (epRes.data && epRes.data.data) {
      malEpisodes = epRes.data.data.map(ep => ({
        number: ep.mal_id,
        name: ep.title
      }));
    }
  } catch (_) {}

  // 3. YouTube trailer (use MyAnimeList verified trailer if available, fallback to YouTube search)
  const trailerUrl = animeInfo.trailer || await getYoutubeTrailer(animeInfo.title || cleanTitle);

  // 4. Build poster URL
  const posterUrl = buildPosterUrl(animeInfo.poster);

  // 5. Copy template blocks
  const { topBlocks, childrenMap } = templateStructure;

  for (const block of topBlocks) {
    if (block.type === 'child_database') continue;

    const newBlock = cleanBlock(block);

    // Synopsis callout
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('synopsis') || (childrenMap[block.id] && childrenMap[block.id][0]?.type === 'heading_2' && childrenMap[block.id][0]?.heading_2?.rich_text?.[0]?.plain_text === 'Synopsis')) {
        const calloutRes = await withRetry(() =>
          notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
        );
        const newCalloutId = calloutRes.results[0].id;

        const templateChildren = childrenMap[block.id] || [];
        const newChildren = templateChildren.map(child => {
          const c = cleanBlock(child);
          if (child.type === 'paragraph' && animeInfo.plot) {
            c.paragraph.rich_text = [{ type: 'text', text: { content: animeInfo.plot.substring(0, 2000) } }];
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
      if (text.toLowerCase().includes('watched')) {
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

    // Informations row (block at index 4 is the paragraph under Informations heading)
    if (block.type === 'paragraph') {
      const index = topBlocks.indexOf(block);
      if (index > 0 && topBlocks[index - 1].type === 'heading_2') {
        const prevText = topBlocks[index - 1].heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (prevText.toLowerCase().includes('information')) {
          newBlock.paragraph.rich_text = [
            { type: 'text', text: { content: 'Format: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${animeInfo.format || 'TV'}  |  ` } },
            { type: 'text', text: { content: 'Studios: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${animeInfo.studio || 'N/A'}  |  ` } },
            { type: 'text', text: { content: 'Aired: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${animeInfo.airedStr || 'N/A'}  |  ` } },
            { type: 'text', text: { content: 'Score: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `⭐ ${animeInfo.score || '0'}` } }
          ];
        }
      }
    }

    // Dynamic Characters Toggle
    if (block.type === 'heading_2') {
      const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('character') && malCharacters.length > 0) {
        newBlock.heading_2.is_toggleable = true;

        const charHeadingRes = await withRetry(() =>
          notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
        );
        const charHeadingId = charHeadingRes.results[0].id;

        const bulletBlocks = malCharacters.map(char => ({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: `🎭 ${char.name} ` } },
              { type: 'text', text: { content: '— VA: ' }, annotations: { italic: true } },
              { type: 'text', text: { content: `${char.va} (Japanese)` }, annotations: { italic: true } }
            ]
          }
        }));

        if (bulletBlocks.length > 0) {
          await withRetry(() =>
            notion.blocks.children.append({ block_id: charHeadingId, children: bulletBlocks })
          );
        }
        continue;
      }
    }

    // Dynamic Episodes Toggle
    if (block.type === 'heading_2') {
      const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('episode') && malEpisodes.length > 0) {
        newBlock.heading_2.is_toggleable = true;

        const epHeadingRes = await withRetry(() =>
          notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
        );
        const epHeadingId = epHeadingRes.results[0].id;

        const todoBlocks = malEpisodes.map(ep => ({
          object: 'block',
          type: 'to_do',
          to_do: {
            rich_text: [{ type: 'text', text: { content: `Ep ${ep.number}: ${ep.name}` } }],
            checked: false
          }
        }));

        for (let k = 0; k < todoBlocks.length; k += 100) {
          const batch = todoBlocks.slice(k, k + 100);
          await withRetry(() =>
            notion.blocks.children.append({ block_id: epHeadingId, children: batch })
          );
        }
        continue;
      }
    }

    // Trailer video
    if (block.type === 'video' && trailerUrl) {
      newBlock.video = { external: { url: trailerUrl } };
    }

    await withRetry(() =>
      notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
    );
  }

  // 7. Update properties + cover + icon
  const props = {
    'Total Episodes':   { number: animeInfo.totalEpisodes || null },
    'MAL Score':        { number: animeInfo.score || null },
    'Synopsis':         { rich_text: [{ text: { content: (animeInfo.plot || '').substring(0, 1900) } }] },
    'MAL URL':          { url: animeInfo.url || null },
    'Studio':           { select: { name: animeInfo.studio || 'N/A' } }
  };
  if (animeInfo.genres.length > 0) {
    props['Genres'] = { multi_select: animeInfo.genres.map(g => ({ name: g.trim() })) };
  }

  const updateParams = { page_id: page.id, properties: props };
  if (posterUrl) updateParams.cover = { type: 'external', external: { url: posterUrl } };
  if (templateStructure.icon) updateParams.icon = templateStructure.icon;

  await withRetry(() => notion.pages.update(updateParams));

  return { status: 'enriched', title: animeInfo.title || rawTitle };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`🎬  BULK ANIME ENRICHMENT — Using Your "New Anime" Template`);
  console.log(`${'═'.repeat(62)}\n`);

  const cp = loadCheckpoint();
  console.log(`📂  Checkpoint: ${Object.keys(cp.done).length} anime from previous run.\n`);

  const templateStructure = await loadTemplateStructure();
  console.log('');

  // Paginate through the Anime database
  let allPages = [], cursor;
  process.stdout.write('Fetching all Anime...');
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
        } else if (status === 'failed_api') {
          cp.done[page.id] = 'failed';
          cp.failed = (cp.failed || 0) + 1;
          console.log(`  ❌ [${done}] ${getPageTitle(page)} — failed to find on MAL`);
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

    // Jikan Jikan rate limit: max 3 requests per second, so 1.2s delay is safe
    if (i + CONCURRENT_PAGES < pending.length) await sleep(BATCH_DELAY_MS);
  }

  const totalSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`✅  COMPLETE — ${Math.floor(totalSec / 60)}m ${totalSec % 60}s`);
  console.log(`   Enriched: ${cp.enriched} | Skipped: ${cp.skipped} | Failed: ${cp.failed || 0}`);
  console.log(`${'═'.repeat(62)}\n`);
}

run();
