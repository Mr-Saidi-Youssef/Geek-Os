/**
 * test_enrich_one.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the template-copy enrichment on ONE specific movie (Oldeuboi).
 * Reads YOUR actual "New Movie" template from Notion (Inception page has the
 * exact same block structure your template creates), copies it to the target
 * page, then fills in movie-specific data.
 *
 * Usage:  node test_enrich_one.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Client } = require('@notionhq/client');
const axios      = require('axios');
require('dotenv').config();

const DATABASE_ID             = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const OMDB_API_KEY            = 'thewdb';
const TARGET_TITLE            = 'The Lord of the Rings: The Return of the King';
const MAX_RETRIES             = 4;
const TEMPLATE_SOURCE_PAGE_ID = '370d0aaf-19d0-8056-8747-df3959410e3f'; // Your New Movie template

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

const OMDB_OVERRIDES = {
  'oldeuboi':                        'Oldboy',
  'oldboy':                          'Oldboy',
  'shichinin no samurai':            'Seven Samurai',
  'seven samurai':                   'Seven Samurai',
  'la vita è bella':                 'Life Is Beautiful',
  'das leben der anderen':           'The Lives of Others',
  'cidade de deus':                  'City of God',
  'amélie':                          'Amélie',
  'amelie':                          'Amélie',
  'sen to chihiro no kamikakushi':   'Spirited Away',
  'mononoke-hime':                   'Princess Mononoke',
  'tonari no totoro':                'My Neighbor Totoro',
  'hotaru no haka':                  'Grave of the Fireflies',
  'tenkuu no shiro rapyuta':         'Castle in the Sky',
  'der untergang':                   'Downfall',
  'das boot':                        'Das Boot',
  'rashômon':                        'Rashomon',
  'il buono, il brutto, il cattivo': 'The Good, the Bad and the Ugly',
  'gake no ue no ponyo':             'Ponyo',
  'majo no takkyuubin':              "Kiki's Delivery Service"
};

function resolveOMDbTitle(rawTitle) {
  const clean = rawTitle.replace(/^[\p{Emoji}\s]+/u, '').trim();
  return OMDB_OVERRIDES[clean.toLowerCase()] || clean;
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
  console.log(`🧪  TEMPLATE-COPY TEST: "${TARGET_TITLE}"`);
  console.log(`${'═'.repeat(60)}\n`);

  // 1. Load YOUR template from Inception page
  console.log(`[1/7] Loading your "New Movie" template from Notion...`);
  const pageDetails = await withRetry(() =>
    notion.pages.retrieve({ page_id: TEMPLATE_SOURCE_PAGE_ID })
  );
  const templateIcon = pageDetails.icon;

  const templateRes = await withRetry(() =>
    notion.blocks.children.list({ block_id: TEMPLATE_SOURCE_PAGE_ID })
  );
  const topBlocks = templateRes.results;
  console.log(`      ✓ Loaded ${topBlocks.length} template blocks.`);

  // Also load children of blocks that have them
  const childrenMap = {};
  for (const block of topBlocks) {
    if (block.has_children && block.type !== 'child_database') {
      const cr = await withRetry(() => notion.blocks.children.list({ block_id: block.id }));
      childrenMap[block.id] = cr.results;
      console.log(`      ✓ Loaded ${cr.results.length} children for "${block.type}" block.`);
    }
  }

  // 2. Find target page in database
  console.log(`\n[2/7] Searching database for "${TARGET_TITLE}"...`);
  const queryRes = await withRetry(() => notion.databases.query({
    database_id: DATABASE_ID,
    filter: { property: 'Title', title: { contains: TARGET_TITLE } }
  }));

  if (queryRes.results.length === 0) {
    console.error(`❌  No page found containing "${TARGET_TITLE}".`);
    return;
  }

  const page = queryRes.results[0];
  const rawTitle = Object.values(page.properties).find(p => p.type === 'title')?.title?.map(t => t.plain_text).join('') || TARGET_TITLE;
  console.log(`      ✓ Found: "${rawTitle}" (ID: ${page.id})`);

  // 3. Check existing blocks
  console.log(`\n[3/7] Checking for existing content on page...`);
  const existing = await withRetry(() => notion.blocks.children.list({ block_id: page.id, page_size: 1 }));
  if (existing.results.length > 0) {
    console.log(`      ⏭️  Page already has content — SKIP (safety check works ✅)`);
    console.log(`      Existing block type: "${existing.results[0].type}"\n`);
    return;
  }
  console.log(`      ✓ Page is blank — will enrich.`);

  // 4. OMDb data
  const omdbTitle = resolveOMDbTitle(rawTitle);
  console.log(`\n[4/7] Fetching OMDb data for "${omdbTitle}"...`);
  const omdbRes = await axios.get(
    `http://www.omdbapi.com/?t=${encodeURIComponent(omdbTitle)}&type=movie&apikey=${OMDB_API_KEY}`,
    { timeout: 10000 }
  );
  const m = omdbRes.data;
  if (m.Response === 'False') throw new Error(`OMDb: ${m.Error}`);
  console.log(`      ✓ "${m.Title}" (${m.Year}) — ${m.Director}`);
  console.log(`        IMDb: ${m.imdbRating} | ${m.Runtime} | ${m.Genre}`);

  // 5. YouTube trailer
  console.log(`\n[5/7] Searching YouTube for trailer...`);
  const trailerUrl = await getYoutubeTrailer(m.Title, m.Year);
  console.log(trailerUrl ? `      ✓ ${trailerUrl}` : `      ⚠️ No trailer found.`);
  const posterUrl = buildPosterUrl(m.Poster);

  // 6. Copy template to target page with data injected
  console.log(`\n[6/7] Copying your template to "${rawTitle}" page...`);

  for (const block of topBlocks) {
    if (block.type === 'child_database') {
      console.log(`      ⏭️  Skipping child_database (API limitation)`);
      continue;
    }

    const newBlock = cleanBlock(block);

    // Synopsis callout — first callout with children that isn't the review
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      if (!text.toLowerCase().includes('watched')) {
        console.log(`      → Appending Synopsis callout...`);
        const res = await withRetry(() => notion.blocks.children.append({
          block_id: page.id, children: [newBlock]
        }));
        const newCalloutId = res.results[0].id;

        // Copy children: heading stays as-is, paragraph gets the plot
        const kids = (childrenMap[block.id] || []).map(child => {
          const c = cleanBlock(child);
          if (child.type === 'paragraph') {
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

    // My Review callout — copy with all sub-structure intact
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('watched')) {
        console.log(`      → Appending My Review callout with sub-structure...`);
        const res = await withRetry(() => notion.blocks.children.append({
          block_id: page.id, children: [newBlock]
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

    // Trailer video — inject real URL
    if (block.type === 'video' && trailerUrl) {
      newBlock.video = { external: { url: trailerUrl } };
      console.log(`      → Trailer video block with ${trailerUrl}`);
    }

    // Cast & Crew bullets — inject real data
    if (block.type === 'bulleted_list_item') {
      const text = block.bulleted_list_item.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.startsWith('Director:')) {
        newBlock.bulleted_list_item.rich_text = [
          { type: 'text', text: { content: 'Director: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Director } }
        ];
        console.log(`      → Director: ${m.Director}`);
      } else if (text.startsWith('Starring:')) {
        newBlock.bulleted_list_item.rich_text = [
          { type: 'text', text: { content: 'Starring: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Actors } }
        ];
        console.log(`      → Starring: ${m.Actors}`);
      } else if (text.startsWith('Writer:')) {
        newBlock.bulleted_list_item.rich_text = [
          { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Writer } }
        ];
        console.log(`      → Writer: ${m.Writer}`);
      }
    }

    await withRetry(() => notion.blocks.children.append({ block_id: page.id, children: [newBlock] }));
  }

  // 7. Update properties + cover
  console.log(`\n[7/7] Updating database properties and cover...`);
  const props = {
    'Director':    { rich_text: [{ text: { content: m.Director } }] },
    'ReleaseYear': { number: parseInt(m.Year, 10) },
    'Runtime':     { number: parseInt(m.Runtime.replace(' min', ''), 10) },
    'IMDbRating':  { number: parseFloat(m.imdbRating) },
    'Synopsis':    { rich_text: [{ text: { content: m.Plot.substring(0, 1900) } }] },
    'Genre':       { multi_select: m.Genre.split(',').map(g => ({ name: g.trim() })) }
  };
  const params = { page_id: page.id, properties: props };
  if (posterUrl) params.cover = { type: 'external', external: { url: posterUrl } };
  if (templateIcon) params.icon = templateIcon;
  await withRetry(() => notion.pages.update(params));
  console.log(`      ✓ Properties + cover poster set.`);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅  SUCCESS — "${m.Title}" enriched using your template!`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`   Page URL : ${page.url}`);
  console.log(`   Trailer  : ${trailerUrl || 'none'}`);
  console.log(`   Poster   : ${posterUrl ? 'set ✓' : 'N/A'}`);
  console.log(`${'═'.repeat(60)}\n`);
}

run().catch(err => console.error('❌ Fatal:', err.message));
