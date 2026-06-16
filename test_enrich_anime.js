/**
 * test_enrich_anime.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests Anime template-copy enrichment on ONE specific anime (Frieren).
 * Reads YOUR actual "New Anime" template from Notion, fetches anime details
 * from Jikan API (including studio, score, voice actors, and episodes), and
 * constructs the dynamic bullet points and checklists.
 *
 * Usage:  node test_enrich_anime.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Client } = require('@notionhq/client');
const axios      = require('axios');
require('dotenv').config();

const DATABASE_ID             = process.env.NOTION_DATABASE_ID || '36dd0aaf19d0800792e7dca0434c570c';
const TARGET_TITLE            = "Frieren: Beyond Journey's End";
const TARGET_PAGE_ID          = '36dd0aaf-19d0-8111-873e-eadc67b91b57'; // Frieren
const MAX_RETRIES             = 4;
const TEMPLATE_SOURCE_PAGE_ID = '370d0aaf-19d0-80a1-bede-df457c930950'; // Your New Anime template

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
  const c = { object: 'block', type: block.type, [block.type]: { ...block[block.type] } };
  delete c[block.type].has_children;
  if (c[block.type].icon === null) delete c[block.type].icon;
  return c;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🧪  ANIME TEMPLATE-COPY TEST: "${TARGET_TITLE}"`);
  console.log(`${'═'.repeat(60)}\n`);

  // 1. Load template page details (icon) and blocks
  console.log(`[1/7] Loading your "New Anime" template from Notion...`);
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

  // 2. Fetch Jikan details (Search -> Info -> Characters -> Episodes)
  console.log(`\n[2/7] Fetching Frieren details from MyAnimeList (Jikan API)...`);
  let malId = 52991; // Sousou no Frieren MAL ID
  let animeInfo = {};
  let malCharacters = [];
  let malEpisodes = [];

  try {
    // A. General info
    console.log('      → Fetching general anime metadata...');
    const infoRes = await axios.get(`https://api.jikan.moe/v4/anime/${malId}`);
    if (infoRes.data && infoRes.data.data) {
      const d = infoRes.data.data;
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
        trailer: d.trailer?.url || null
      };
      console.log(`        ✓ Title: "${animeInfo.title}" · Studio: ${animeInfo.studio} · Score: ${animeInfo.score}`);
    }

    await sleep(1000); // Respect Jikan rate limit

    // B. Characters & Voice Actors
    console.log('      → Fetching characters and voice actors...');
    const charRes = await axios.get(`https://api.jikan.moe/v4/anime/${malId}/characters`);
    if (charRes.data && charRes.data.data) {
      // Get main characters
      const mainChars = charRes.data.data.filter(c => c.role === 'Main' || c.role === 'Supporting').slice(0, 6);
      malCharacters = mainChars.map(c => {
        const jaVA = c.voice_actors?.find(va => va.language === 'Japanese');
        return {
          name: c.character.name.replace(/, /g, ' '),
          va: jaVA ? jaVA.person.name.replace(/, /g, ' ') : 'N/A'
        };
      });
      console.log(`        ✓ Loaded ${malCharacters.length} key characters.`);
    }

    await sleep(1000);

    // C. Episodes
    console.log('      → Fetching episode lists...');
    const epRes = await axios.get(`https://api.jikan.moe/v4/anime/${malId}/episodes`);
    if (epRes.data && epRes.data.data) {
      malEpisodes = epRes.data.data.map(ep => ({
        number: ep.mal_id,
        name: ep.title
      }));
      console.log(`        ✓ Loaded ${malEpisodes.length} episodes.`);
    }
  } catch (error) {
    console.log(`      ⚠️  Failed to fetch Jikan data: ${error.message}`);
  }

  // 3. YouTube trailer (use MyAnimeList verified trailer if available, fallback to YouTube search)
  const trailerUrl = animeInfo.trailer || await getYoutubeTrailer(TARGET_TITLE);
  console.log(trailerUrl ? `      ✓ ${trailerUrl}` : `      ⚠️ No trailer found.`);
  const posterUrl = buildPosterUrl(animeInfo.poster);

  // 4. Clear existing page blocks (for clean re-run)
  console.log(`\n[4/7] Clearing any existing blocks on target page...`);
  const existingRes = await withRetry(() => notion.blocks.children.list({ block_id: TARGET_PAGE_ID }));
  for (const block of existingRes.results) {
    await withRetry(() => notion.blocks.delete({ block_id: block.id }));
  }
  console.log(`      ✓ Page cleared.`);

  // 5. Copy template to target page with data injected
  console.log(`\n[5/7] Copying your Anime template to "Frieren" page...`);

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
          if (child.type === 'paragraph' && animeInfo.plot) {
            c.paragraph.rich_text = [{ type: 'text', text: { content: animeInfo.plot } }];
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

    // Informations row (block at index 4 is the paragraph under Informations heading)
    if (block.type === 'paragraph') {
      const index = topBlocks.indexOf(block);
      if (index > 0 && topBlocks[index - 1].type === 'heading_2') {
        const prevText = topBlocks[index - 1].heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (prevText.toLowerCase().includes('information')) {
          console.log(`      → Setting Informations row...`);
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
      if (text.toLowerCase().includes('character')) {
        console.log(`      → Generating dynamic Characters & VAs checklist...`);
        newBlock.heading_2.is_toggleable = true;

        const charHeadingRes = await withRetry(() => notion.blocks.children.append({
          block_id: TARGET_PAGE_ID,
          children: [newBlock]
        }));
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
          await withRetry(() => notion.blocks.children.append({
            block_id: charHeadingId,
            children: bulletBlocks
          }));
        }
        console.log(`        ✓ Characters & voice actors bullet points built.`);
        continue;
      }
    }

    // Dynamic Episodes Toggle
    if (block.type === 'heading_2') {
      const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('episode')) {
        console.log(`      → Generating dynamic Episodes checklist...`);
        newBlock.heading_2.is_toggleable = true;

        const epHeadingRes = await withRetry(() => notion.blocks.children.append({
          block_id: TARGET_PAGE_ID,
          children: [newBlock]
        }));
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
          await withRetry(() => notion.blocks.children.append({
            block_id: epHeadingId,
            children: batch
          }));
        }
        console.log(`        ✓ Episodes checkbox list built.`);
        continue;
      }
    }

    // Trailer video
    if (block.type === 'video' && trailerUrl) {
      newBlock.video = { external: { url: trailerUrl } };
      console.log(`      → Trailer video block with ${trailerUrl}`);
    }

    await withRetry(() => notion.blocks.children.append({ block_id: TARGET_PAGE_ID, children: [newBlock] }));
  }

  // 6. Update database properties + cover + icon
  console.log(`\n[6/7] Updating database properties and cover...`);
  const props = {
    'Total Episodes':   { number: animeInfo.totalEpisodes || null },
    'MAL Score':        { number: animeInfo.score || null },
    'Synopsis':         { rich_text: [{ text: { content: (animeInfo.plot || '').substring(0, 1900) } }] },
    'Studio':           { select: { name: animeInfo.studio || 'N/A' } },
    'Genres':           { multi_select: animeInfo.genres.map(g => ({ name: g.trim() })).filter(g => g.name) }
  };

  const params = { page_id: TARGET_PAGE_ID, properties: props };
  if (posterUrl) params.cover = { type: 'external', external: { url: posterUrl } };
  if (templateIcon) params.icon = templateIcon;

  await withRetry(() => notion.pages.update(params));
  console.log(`      ✓ Properties + cover poster + icon set.`);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅  SUCCESS — "${TARGET_TITLE}" enriched using your template!`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`   Page URL : https://www.notion.so/Frieren-${TARGET_PAGE_ID.replace(/-/g, '')}`);
  console.log(`   Trailer  : ${trailerUrl || 'none'}`);
  console.log(`   Poster   : set ✓`);
  console.log(`   Episodes : ${malEpisodes.length}`);
  console.log(`${'═'.repeat(60)}\n`);
}

run().catch(err => console.error('❌ Fatal:', err.message));
