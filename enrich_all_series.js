/**
 * enrich_all_series.js  (v1 — copies YOUR exact Notion TV template)
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses your "New Series" template page as the template source.
 *
 * For every blank TV series page it will:
 *   1. Read the template blocks live from the source page
 *   2. Copy the entire structure to the target TV series page
 *   3. Fetch real season/episode details from TVMaze and OMDb
 *   4. Construct a beautiful, nested checkbox toggle checklist for the episodes
 *   5. Set the high-res poster as the page cover
 *   6. Update database properties (ReleaseYear, Runtime, IMDbRating, Genres,
 *      Seasons, Episodes, Trailer URL, icon)
 *
 * KEY FEATURES:
 *   • Template is read LIVE from your Notion page — matches it 100%
 *   • Auto-generates the real TV episodes checklist dynamically
 *   • Concurrency: 2 pages at a time (safe for Notion rate limits)
 *   • withRetry(): auto-waits on 429 errors using the retry-after header
 *   • Checkpoint file: resume if interrupted (Ctrl+C safe)
 *
 * Usage:
 *   node enrich_all_series.js              ← enrich all blank series
 *   node enrich_all_series.js --reset      ← clear checkpoint and restart
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Client } = require('@notionhq/client');
const axios      = require('axios');
const fs         = require('fs');
const path       = require('path');
require('dotenv').config();

// ─── Configuration ────────────────────────────────────────────────────────────

const DATABASE_ID      = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';
const OMDB_API_KEY     = 'thewdb';
const CONCURRENT_PAGES = 2;
const BATCH_DELAY_MS   = 700;
const MAX_RETRIES      = 5;
const CHECKPOINT_FILE  = path.join(__dirname, 'enrich_series_checkpoint.json');

const TEMPLATE_SOURCE_PAGE_ID = '370d0aaf-19d0-80da-ae71-d2b907a48250'; // Your New Series template

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
    const q = encodeURIComponent(`${title} ${year || ''} official trailer`);
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
  let url = raw;
  if (url.includes('m.media-amazon.com/images/')) url = url.replace(/@\._V1_.*\.jpg$/, '@.jpg');
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
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
  console.log(`📋  Loading TV template structure and details from source page...`);
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

// ─── TV Show Title Override List ──────────────────────────────────────────────

const TV_OVERRIDES = {
  'little witch academia (tv)': 'Little Witch Academia',
  'wind: a breath of heart (tv)': 'Wind: A Breath of Heart',
  'area 88 (tv)': 'Area 88',
  'pucca (tv)': 'Pucca',
  'pucca (tv) 2nd season': 'Pucca',
  'sakura wars tv': 'Sakura Wars',
  'kemurikusa (tv)': 'Kemurikusa',
  'black jack (tv)': 'Black Jack'
};

function resolveTVTitle(rawTitle) {
  const clean = rawTitle.replace(/^[\p{Emoji}\s]+/u, '').trim();
  return TV_OVERRIDES[clean.toLowerCase()] || clean;
}

// ─── Enrich a single TV series page ───────────────────────────────────────────

async function enrichPage(page, templateStructure) {
  const rawTitle = getPageTitle(page);

  // 1. Skip if already has content
  const existing = await withRetry(() =>
    notion.blocks.children.list({ block_id: page.id, page_size: 1 })
  );
  if (existing.results.length > 0) {
    return { status: 'skipped', title: rawTitle };
  }

  const cleanTitle = resolveTVTitle(rawTitle);

  // 2. Fetch TVMaze seasons and episodes
  let tvMazeDetails = { seasonsCount: 0, episodesCount: 0, episodesList: [] };
  try {
    const tvmazeUrl = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle)}&embed[]=seasons&embed[]=episodes`;
    const response = await axios.get(tvmazeUrl);
    if (response.data && response.data._embedded) {
      const seasons = response.data._embedded.seasons;
      const episodes = response.data._embedded.episodes;
      tvMazeDetails = {
        seasonsCount: seasons.length,
        episodesCount: episodes.length,
        episodesList: episodes
      };
    }
  } catch (_) {
    // If exact query fails, try simplified search
    try {
      const simplified = cleanTitle.replace(/[\(\):\/].*$/, '').trim();
      const tvmazeUrl = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(simplified)}&embed[]=seasons&embed[]=episodes`;
      const response = await axios.get(tvmazeUrl);
      if (response.data && response.data._embedded) {
        const seasons = response.data._embedded.seasons;
        const episodes = response.data._embedded.episodes;
        tvMazeDetails = {
          seasonsCount: seasons.length,
          episodesCount: episodes.length,
          episodesList: episodes
        };
      }
    } catch (_) {}
  }

  // 3. Fetch OMDb data
  let m;
  try {
    const res = await axios.get(
      `http://www.omdbapi.com/?t=${encodeURIComponent(cleanTitle)}&type=series&apikey=${OMDB_API_KEY}`,
      { timeout: 10000 }
    );
    m = res.data;
    if (m.Response === 'False') throw new Error(m.Error);
  } catch (_) {
    m = {
      Title: rawTitle, Year: '', Director: 'N/A', Actors: 'N/A',
      Writer: 'N/A', Plot: '', Genre: '', Runtime: '0 min',
      imdbRating: '0', Poster: 'N/A'
    };
  }

  // 4. YouTube trailer
  const startYear = m.Year ? m.Year.split('–')[0].trim() : '';
  const trailerUrl = await getYoutubeTrailer(m.Title || cleanTitle, startYear);

  // 5. Build poster URL
  const posterUrl = buildPosterUrl(m.Poster);

  // 6. Copy template blocks to the target page, injecting TV show data
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
          if (child.type === 'paragraph' && m.Plot) {
            c.paragraph.rich_text = [{ type: 'text', text: { content: m.Plot.substring(0, 2000) } }];
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

    // Dynamic Seasons Toggle list
    if (block.type === 'heading_2') {
      const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('seasons') && tvMazeDetails.seasonsCount > 0) {
        
        // Ensure heading_2 is toggleable
        newBlock.heading_2.is_toggleable = true;

        const seasonsHeadingRes = await withRetry(() =>
          notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
        );
        const seasonsHeadingId = seasonsHeadingRes.results[0].id;

        // Group by season
        const seasonsMap = {};
        tvMazeDetails.episodesList.forEach(ep => {
          if (!seasonsMap[ep.season]) seasonsMap[ep.season] = [];
          seasonsMap[ep.season].push(ep);
        });

        // Add Season Toggles recursively
        for (let s = 1; s <= tvMazeDetails.seasonsCount; s++) {
          const seasonEpisodes = seasonsMap[s] || [];
          if (seasonEpisodes.length === 0) continue;

          const seasonToggleBlock = {
            object: 'block',
            type: 'heading_3',
            heading_3: {
              rich_text: [{ type: 'text', text: { content: `Season ${s}` } }],
              color: 'default',
              is_toggleable: true
            }
          };

          const sToggleRes = await withRetry(() =>
            notion.blocks.children.append({ block_id: seasonsHeadingId, children: [seasonToggleBlock] })
          );
          const seasonToggleId = sToggleRes.results[0].id;

          const todoBlocks = seasonEpisodes.map(ep => ({
            object: 'block',
            type: 'to_do',
            to_do: {
              rich_text: [{ type: 'text', text: { content: `S${ep.season}E${ep.number}: ${ep.name}` } }],
              checked: false
            }
          }));

          // Append in batches of 100
          for (let k = 0; k < todoBlocks.length; k += 100) {
            const batch = todoBlocks.slice(k, k + 100);
            await withRetry(() =>
              notion.blocks.children.append({ block_id: seasonToggleId, children: batch })
            );
          }
        }
        continue;
      }
    }

    // Trailer video block
    if (block.type === 'video' && trailerUrl) {
      newBlock.video = { external: { url: trailerUrl } };
    }

    // Cast & Crew bullets
    if (block.type === 'bulleted_list_item') {
      const text = block.bulleted_list_item.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.startsWith('Director:') && m.Director && m.Director !== 'N/A') {
        newBlock.bulleted_list_item.rich_text = [
          { type: 'text', text: { content: 'Director: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Director } }
        ];
      } else if (text.startsWith('Starring:') && m.Actors && m.Actors !== 'N/A') {
        newBlock.bulleted_list_item.rich_text = [
          { type: 'text', text: { content: 'Starring: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Actors } }
        ];
      } else if (text.startsWith('Writer:') && m.Writer && m.Writer !== 'N/A') {
        newBlock.bulleted_list_item.rich_text = [
          { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Writer } }
        ];
      }
    }

    // Append standard block
    await withRetry(() =>
      notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
    );
  }

  // 7. Update database properties + cover + icon
  const props = {
    'ReleaseYear': { number: parseInt(startYear, 10) || null },
    'Runtime':     { number: parseInt((m.Runtime || '').replace(' min', ''), 10) || null },
    'IMDbRating':  { number: parseFloat(m.imdbRating) || null },
    'Synopsis':    { rich_text: [{ text: { content: (m.Plot || '').substring(0, 1900) } }] },
    'Seasons':     { number: tvMazeDetails.seasonsCount || null },
    'Total Episodes': { number: tvMazeDetails.episodesCount || null },
    'Trailer':     { url: trailerUrl || null }
  };
  if (m.Genre && m.Genre !== 'N/A') {
    props['Genre'] = { multi_select: m.Genre.split(',').map(g => ({ name: g.trim() })) };
  }

  const updateParams = { page_id: page.id, properties: props };
  if (posterUrl) updateParams.cover = { type: 'external', external: { url: posterUrl } };
  if (templateStructure.icon) updateParams.icon = templateStructure.icon;

  await withRetry(() => notion.pages.update(updateParams));

  return { status: 'enriched', title: m.Title || rawTitle };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`🎬  BULK TV SERIES ENRICHMENT — Using Your "New Series" Template`);
  console.log(`${'═'.repeat(62)}\n`);

  const cp = loadCheckpoint();
  console.log(`📂  Checkpoint: ${Object.keys(cp.done).length} series from previous run.\n`);

  const templateStructure = await loadTemplateStructure();
  console.log('');

  // Paginate through the TV Show database
  let allPages = [], cursor;
  process.stdout.write('Fetching all TV Series...');
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
