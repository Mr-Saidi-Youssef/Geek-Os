/**
 * test_enrich_series.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests TV Series enrichment on ONE specific show (Breaking Bad).
 * Reads YOUR actual "New Series" template from Notion, fetches series details
 * from OMDb and TVMaze (including all seasons and episode titles), constructs
 * a beautiful nested checkbox toggle checklist for the episodes, and populates
 * the target page.
 *
 * Usage:  node test_enrich_series.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Client } = require('@notionhq/client');
const axios      = require('axios');
require('dotenv').config();

const DATABASE_ID             = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';
const OMDB_API_KEY            = 'thewdb';
const TARGET_TITLE            = 'Breaking Bad';
const TARGET_PAGE_ID          = '36ed0aaf-19d0-8188-bd15-da41113c665f'; // Breaking Bad
const MAX_RETRIES             = 4;
const TEMPLATE_SOURCE_PAGE_ID = '370d0aaf-19d0-80da-ae71-d2b907a48250'; // Your New Series template

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
  const c = { object: 'block', type: block.type, [block.type]: { ...block[block.type] } };
  delete c[block.type].has_children;
  if (c[block.type].icon === null) delete c[block.type].icon;
  return c;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🧪  TV-SERIES TEMPLATE-COPY TEST: "${TARGET_TITLE}"`);
  console.log(`${'═'.repeat(60)}\n`);

  // 1. Load template page details (icon) and blocks
  console.log(`[1/7] Loading your "New Series" template from Notion...`);
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

  // 2. Fetch TVMaze seasons and episodes
  console.log(`\n[2/7] Fetching real seasons & episode list from TVMaze...`);
  let tvMazeDetails = { seasonsCount: 0, episodesCount: 0, episodesList: [] };
  try {
    const tvmazeUrl = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(TARGET_TITLE)}&embed[]=seasons&embed[]=episodes`;
    const response = await axios.get(tvmazeUrl);
    if (response.data && response.data._embedded) {
      const seasons = response.data._embedded.seasons;
      const episodes = response.data._embedded.episodes;
      tvMazeDetails = {
        seasonsCount: seasons.length,
        episodesCount: episodes.length,
        episodesList: episodes
      };
      console.log(`      ✓ Found ${seasons.length} seasons, ${episodes.length} episodes.`);
    }
  } catch (error) {
    console.log(`      ⚠️  Failed to fetch TVMaze data: ${error.message}`);
  }

  // 3. Fetch OMDb data
  console.log(`\n[3/7] Fetching OMDb data for "${TARGET_TITLE}"...`);
  const omdbRes = await axios.get(
    `http://www.omdbapi.com/?t=${encodeURIComponent(TARGET_TITLE)}&type=series&apikey=${OMDB_API_KEY}`,
    { timeout: 10000 }
  );
  const m = omdbRes.data;
  if (m.Response === 'False') throw new Error(`OMDb: ${m.Error}`);
  console.log(`      ✓ "${m.Title}" (${m.Year}) · IMDb: ${m.imdbRating}`);

  // 4. YouTube trailer
  console.log(`\n[4/7] Searching YouTube for trailer...`);
  const trailerUrl = await getYoutubeTrailer(m.Title, m.Year ? m.Year.split('–')[0] : '');
  console.log(trailerUrl ? `      ✓ ${trailerUrl}` : `      ⚠️ No trailer found.`);
  const posterUrl = buildPosterUrl(m.Poster);

  // 5. Copy template to target page with data injected
  console.log(`\n[5/7] Copying your TV template to "Breaking Bad" page...`);

  for (const block of topBlocks) {
    if (block.type === 'child_database') continue;

    const newBlock = cleanBlock(block);

    // Synopsis callout
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('synopsis') || (childrenMap[block.id] && childrenMap[block.id][0]?.type === 'heading_2' && childrenMap[block.id][0]?.heading_2?.rich_text?.[0]?.plain_text === 'Synopsis')) {
        console.log(`      → Appending Synopsis callout...`);
        const res = await withRetry(() => notion.blocks.children.append({
          block_id: TARGET_PAGE_ID, children: [newBlock]
        }));
        const newCalloutId = res.results[0].id;

        const kids = (childrenMap[block.id] || []).map(child => {
          const c = cleanBlock(child);
          if (child.type === 'paragraph' && m.Plot) {
            c.paragraph.rich_text = [{ type: 'text', text: { content: m.Plot } }];
          }
          return c;
        });
        if (kids.length > 0) {
          await withRetry(() => notion.blocks.children.append({ block_id: newCalloutId, children: kids }));
        }
        console.log(`        ✓ Synopsis + plot filled inside callout.`);
        continue;
      }
    }

    // My Review callout
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('watched')) {
        console.log(`      → Appending My Review callout with sub-structure...`);
        const res = await withRetry(() => notion.blocks.children.append({
          block_id: TARGET_PAGE_ID, children: [newBlock]
        }));
        const reviewId = res.results[0].id;
        const kids = (childrenMap[block.id] || []).map(c => cleanBlock(c));
        if (kids.length > 0) {
          await withRetry(() => notion.blocks.children.append({ block_id: reviewId, children: kids }));
        }
        console.log(`        ✓ My Review callout with structure copied.`);
        continue;
      }
    }

    // Dynamic Seasons Toggle Heading
    if (block.type === 'heading_2') {
      const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('seasons')) {
        console.log(`      → Generating dynamic Seasons & Episodes checklist...`);
        
        // Ensure the main "Seasons" heading_2 is toggleable
        newBlock.heading_2.is_toggleable = true;

        // Append the main "Seasons" toggle heading
        const res = await withRetry(() => notion.blocks.children.append({
          block_id: TARGET_PAGE_ID,
          children: [newBlock]
        }));
        const seasonsHeadingId = res.results[0].id;

        // Group TVMaze episodes by season
        const seasonsMap = {};
        tvMazeDetails.episodesList.forEach(ep => {
          if (!seasonsMap[ep.season]) seasonsMap[ep.season] = [];
          seasonsMap[ep.season].push(ep);
        });

        // Loop through each season and create nested heading_3 toggles
        for (let s = 1; s <= tvMazeDetails.seasonsCount; s++) {
          const seasonEpisodes = seasonsMap[s] || [];
          console.log(`        → Generating Season ${s} toggle with ${seasonEpisodes.length} episodes...`);
          
          // Create the "Season X" toggle block (heading_3)
          const seasonToggleBlock = {
            object: 'block',
            type: 'heading_3',
            heading_3: {
              rich_text: [{ type: 'text', text: { content: `Season ${s}` } }],
              color: 'default',
              is_toggleable: true
            }
          };

          const sRes = await withRetry(() => notion.blocks.children.append({
            block_id: seasonsHeadingId,
            children: [seasonToggleBlock]
          }));
          const seasonToggleId = sRes.results[0].id;

          // Split episodes into batches of 100 (Notion API max children limit is 100)
          const todoBlocks = seasonEpisodes.map(ep => ({
            object: 'block',
            type: 'to_do',
            to_do: {
              rich_text: [{ type: 'text', text: { content: `S${ep.season}E${ep.number}: ${ep.name}` } }],
              checked: false
            }
          }));

          // Append todo checkbox blocks inside the Season toggle
          for (let k = 0; k < todoBlocks.length; k += 100) {
            const batch = todoBlocks.slice(k, k + 100);
            await withRetry(() => notion.blocks.children.append({
              block_id: seasonToggleId,
              children: batch
            }));
          }
        }
        console.log(`        ✓ Seasons and Episodes checklists built.`);
        continue;
      }
    }

    // Trailer video
    if (block.type === 'video' && trailerUrl) {
      newBlock.video = { external: { url: trailerUrl } };
      console.log(`      → Trailer video block with ${trailerUrl}`);
    }

    // Cast & Crew bullets
    if (block.type === 'bulleted_list_item') {
      const text = block.bulleted_list_item.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.startsWith('Director:')) {
        newBlock.bulleted_list_item.rich_text = [
          { type: 'text', text: { content: 'Director: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Director || 'N/A' } }
        ];
        console.log(`      → Director: ${m.Director}`);
      } else if (text.startsWith('Starring:')) {
        newBlock.bulleted_list_item.rich_text = [
          { type: 'text', text: { content: 'Starring: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Actors || 'N/A' } }
        ];
        console.log(`      → Starring: ${m.Actors}`);
      } else if (text.startsWith('Writer:')) {
        newBlock.bulleted_list_item.rich_text = [
          { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Writer || 'N/A' } }
        ];
        console.log(`      → Writer: ${m.Writer}`);
      }
    }

    await withRetry(() => notion.blocks.children.append({ block_id: TARGET_PAGE_ID, children: [newBlock] }));
  }

  // 6. Update database properties + cover + icon
  console.log(`\n[6/7] Updating database properties and cover...`);
  const props = {
    'ReleaseYear': { number: parseInt(m.Year ? m.Year.split('–')[0] : '0', 10) || null },
    'Runtime':     { number: parseInt((m.Runtime || '').replace(' min', ''), 10) || null },
    'IMDbRating':  { number: parseFloat(m.imdbRating) || null },
    'Synopsis':    { rich_text: [{ text: { content: (m.Plot || '').substring(0, 1900) } }] },
    'Genre':       { multi_select: (m.Genre || '').split(',').map(g => ({ name: g.trim() })).filter(g => g.name) },
    'Seasons':     { number: tvMazeDetails.seasonsCount || null },
    'Total Episodes': { number: tvMazeDetails.episodesCount || null },
    'Trailer':     { url: trailerUrl || null }
  };

  const params = { page_id: TARGET_PAGE_ID, properties: props };
  if (posterUrl) params.cover = { type: 'external', external: { url: posterUrl } };
  if (templateIcon) params.icon = templateIcon;

  await withRetry(() => notion.pages.update(params));
  console.log(`      ✓ Properties + cover poster + icon set.`);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅  SUCCESS — "${m.Title}" enriched using your template!`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`   Page URL : https://www.notion.so/Breaking-Bad-${TARGET_PAGE_ID.replace(/-/g, '')}`);
  console.log(`   Trailer  : ${trailerUrl || 'none'}`);
  console.log(`   Poster   : set ✓`);
  console.log(`   Seasons  : ${tvMazeDetails.seasonsCount} | Episodes: ${tvMazeDetails.episodesCount}`);
  console.log(`${'═'.repeat(60)}\n`);
}

run().catch(err => console.error('❌ Fatal:', err.message));
