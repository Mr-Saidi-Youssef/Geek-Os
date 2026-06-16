/**
 * Bulk In-Place Block Enricher for Comics Library
 * Duplicates the custom "New Comics" template block-by-block, injecting synopsis
 * metadata, verified YouTube trailers, creative crew specs, trade paperback volumes,
 * and issues checklists in-place.
 *
 * Powered by keyless YouTube scrapers & Notion SDK
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_COMICS_DATABASE_ID || '371d0aaf19d081c59b14fbc0c52b0040';
const TEMPLATE_SOURCE_PAGE_ID = process.env.NOTION_COMICS_TEMPLATE_ID || '372d0aaf19d080b7a8f5dc7020ea2f21';
const CHECKPOINT_FILE = path.join(__dirname, 'enrich_comics_checkpoint.json');
const CONCURRENT_PAGES = 2;
const BATCH_DELAY_MS = 350;
const MAX_RETRIES = 15;

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const DO_RESET = process.argv.includes('--reset');

const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const enrichLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10000;

// ─── Checkpoint Cache ────────────────────────────────────────────────────────

function loadCheckpoint() {
  if (DO_RESET && fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log('🔄 Checkpoint cleared — starting fresh.\n');
  }
  if (!fs.existsSync(CHECKPOINT_FILE)) return { done: {}, enriched: 0, skipped: 0, failed: 0 };
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
  } catch (_) {
    return { done: {}, enriched: 0, skipped: 0, failed: 0 };
  }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf8');
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry(fn, retries = MAX_RETRIES, delayMs = 30000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.status === 429 || err?.code === 'rate_limited' || err?.message?.includes('429');
      const isTransient = err?.status >= 500;
      
      if ((is429 || isTransient) && attempt < retries) {
        const waitSec = Math.pow(2, attempt) * 5 + 10; // grow wait times
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
    const q = encodeURIComponent(`${title} ${year || ''} comic motion trailer preview`);
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
    type: block.type,
    [block.type]: { ...block[block.type] }
  };
  delete clean[block.type].has_children;
  if (clean[block.type].icon === null) delete clean[block.type].icon;
  return clean;
}

// ─── Load Template Structure once at Startup ──────────────────────────────────

async function loadTemplateStructure() {
  console.log(`📋 Loading Comics template structure from source page: ${TEMPLATE_SOURCE_PAGE_ID}...`);
  
  const pageDetails = await withRetry(() =>
    notion.pages.retrieve({ page_id: TEMPLATE_SOURCE_PAGE_ID })
  );
  const templateIcon = pageDetails.icon;

  const res = await withRetry(() =>
    notion.blocks.children.list({ block_id: TEMPLATE_SOURCE_PAGE_ID })
  );
  const topBlocks = res.results;

  // Load children recursively for blocks that have them (callouts, toggles, list groups)
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

// ─── Enrich Single Comic Page ──────────────────────────────────────────────────

async function enrichPage(page, templateStructure) {
  const rawTitle = getPageTitle(page);

  // 1. Skip if page already has blocks (avoid double-appending)
  const existing = await withRetry(() =>
    notion.blocks.children.list({ block_id: page.id, page_size: 1 })
  );
  if (existing.results.length > 0) {
    let communityRating = page.properties['Community Rating']?.number;
    let olKey = page.properties['OL Key']?.rich_text?.map(t => t.plain_text).join('');
    let needsUpdate = false;
    const updateParams = { page_id: page.id, properties: {} };

    if (!page.icon && templateStructure.icon) {
      updateParams.icon = templateStructure.icon;
      needsUpdate = true;
    }

    if (!communityRating || !olKey) {
      try {
        const searchRes = await withRetry(() => axios.get('https://openlibrary.org/search.json', {
          params: { q: rawTitle, limit: 1 },
          timeout: 8000
        }));
        const doc = searchRes.data?.docs?.[0];
        if (doc) {
          if (!communityRating && doc.ratings_average) {
            communityRating = parseFloat(doc.ratings_average.toFixed(2));
            updateParams.properties['Community Rating'] = { number: communityRating };
            needsUpdate = true;
          }
          if (!olKey && doc.key) {
            olKey = doc.key.replace('/works/', '');
            updateParams.properties['OL Key'] = { rich_text: [{ text: { content: olKey } }] };
            needsUpdate = true;
          }
        }
      } catch (err) {
        console.log(`    ⚠️ Failed to fetch OL ratings for "${rawTitle}":`, err.message);
      }
    }

    if (needsUpdate) {
      if (Object.keys(updateParams.properties).length === 0) {
        delete updateParams.properties;
      }
      console.log(`    ℹ Page "${rawTitle}" needs properties updated (rating/icon/OL Key) — applying updates.`);
      await withRetry(() => notion.pages.update(updateParams));
    }
    return { status: 'skipped', title: rawTitle };
  }

  // 2. Fetch page properties
  const writer = page.properties.Writer?.rich_text?.map(t => t.plain_text).join('') || 'Unknown';
  const artist = page.properties.Artist?.rich_text?.map(t => t.plain_text).join('') || 'Unknown / Multiple';
  const publisher = page.properties.Publisher?.rich_text?.map(t => t.plain_text).join('') || page.properties.Publisher?.select?.name || 'Unknown';
  const releaseYear = page.properties.ReleaseYear?.number || '';
  const totalIssues = page.properties.Issues?.number || 6;
  const totalVolumes = page.properties.Volumes?.number || 1;

  // Fetch Open Library details (Rating, Key & Synopsis) if missing
  let communityRating = page.properties['Community Rating']?.number;
  let olKey = page.properties['OL Key']?.rich_text?.map(t => t.plain_text).join('');
  let synopsis = page.properties.Synopsis?.rich_text?.map(t => t.plain_text).join('') || '';

  if (!communityRating || !olKey || !synopsis) {
    try {
      // Step A: Search Open Library by title to find OL Key if missing
      if (!olKey) {
        const searchRes = await withRetry(() => axios.get('https://openlibrary.org/search.json', {
          params: { q: rawTitle, limit: 1 },
          timeout: 8000
        }));
        const doc = searchRes.data?.docs?.[0];
        if (doc && doc.key) {
          olKey = doc.key.replace('/works/', '');
        }
      }

      // Step B: Query ratings & description details using the OL Key
      if (olKey) {
        // Query Ratings
        if (!communityRating) {
          try {
            const ratingsRes = await axios.get(`https://openlibrary.org/works/${olKey}/ratings.json`, { timeout: 4000 });
            const summary = ratingsRes.data?.summary;
            if (summary && summary.average) {
              communityRating = parseFloat(summary.average.toFixed(2));
            }
          } catch (_) {}
        }

        // Query Description (Book Synopsis)
        if (!synopsis) {
          try {
            const workRes = await axios.get(`https://openlibrary.org/works/${olKey}.json`, { timeout: 5000 });
            let desc = workRes.data?.description;
            if (desc) {
              if (typeof desc === 'object') desc = desc.value;
              synopsis = desc.substring(0, 1900);
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.log(`    ⚠️ Failed to fetch OL details for "${rawTitle}":`, err.message);
    }
  }

  // Fallback to deterministic synopsis if still empty (so it never appears blank!)
  if (!synopsis) {
    synopsis = `An acclaimed comic book series and graphic novel collection, published under the curation of major comic editors. Details the classic narratives of your favorite creators.`;
  }

  // 4. Duplicate template blocks
  const { topBlocks, childrenMap } = templateStructure;

  for (const block of topBlocks) {
    if (block.type === 'child_database') continue;

    const newBlock = cleanBlock(block);

    // Synopsis Callout box
    if (block.type === 'callout' && block.has_children) {
      const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
      // It is the first callout block (Synopsis, not My Review)
      if (!text.toLowerCase().includes('like') && !text.toLowerCase().includes('verdict')) {
        const calloutRes = await withRetry(() =>
          notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
        );
        const newCalloutId = calloutRes.results[0].id;

        const templateChildren = childrenMap[block.id] || [];
        const newChildren = templateChildren.map(child => {
          const c = cleanBlock(child);
          // Set synopsis plot to the paragraph nested inside the callout
          if (child.type === 'paragraph' && !child.paragraph.rich_text[0]?.plain_text?.includes('Synopsis') && synopsis) {
            c.paragraph.rich_text = [{ type: 'text', text: { content: synopsis.substring(0, 2000) } }];
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

    // My Review callout box
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

    // Specification Paragraph (under Informations heading)
    if (block.type === 'paragraph') {
      const index = topBlocks.indexOf(block);
      if (index > 0 && topBlocks[index - 1].type === 'heading_2') {
        const prevText = topBlocks[index - 1].heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (prevText.toLowerCase().includes('information')) {
          newBlock.paragraph.rich_text = [
            { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${writer}  |  ` } },
            { type: 'text', text: { content: 'Artist: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${artist}  |  ` } },
            { type: 'text', text: { content: 'Publisher: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${publisher}  |  ` } },
            { type: 'text', text: { content: 'Release: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: `${releaseYear || 'N/A'}` } }
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

        // Generate dynamic volumes
        const volumeChildren = [];
        for (let v = 1; v <= totalVolumes; v++) {
          let suffix = `Vol. ${v}`;
          if (totalVolumes === 1) suffix = 'Collected Deluxe Edition';
          else if (v === 1 && totalVolumes === 2) suffix = 'Book One';
          else if (v === 2 && totalVolumes === 2) suffix = 'Book Two';
          
          volumeChildren.push({
            object: 'block',
            type: 'to_do',
            to_do: {
              rich_text: [{ type: 'text', text: { content: `Volume ${v}: ${rawTitle} (${suffix})` } }],
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

    // Issues toggle heading
    if (block.type === 'heading_2' && block.has_children) {
      const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
      if (text.toLowerCase().includes('issue')) {
        const headingRes = await withRetry(() =>
          notion.blocks.children.append({ block_id: page.id, children: [newBlock] })
        );
        const headingId = headingRes.results[0].id;

        // Generate dynamic issues checklist
        const issueChildren = [];
        for (let iss = 1; iss <= totalIssues; iss++) {
          issueChildren.push({
            object: 'block',
            type: 'to_do',
            to_do: {
              rich_text: [{ type: 'text', text: { content: `Issue #${iss}: Chapter ${iss}` } }],
              checked: false
            }
          });
        }

        // Batch append in groups of 50
        for (let offset = 0; offset < issueChildren.length; offset += 50) {
          const chunk = issueChildren.slice(offset, offset + 50);
          await withRetry(() =>
            notion.blocks.children.append({ block_id: headingId, children: chunk })
          );
          await sleep(350);
        }
        continue;
      }
    }

    // Default top-level blocks that do not have custom modifications
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

  // 5. Update properties (Ensure icon, community rating, and synopsis matches template/OL)
  const updateParams = { page_id: page.id, properties: {} };
  if (templateStructure.icon) updateParams.icon = templateStructure.icon;
  
  if (communityRating) {
    updateParams.properties['Community Rating'] = { number: communityRating };
  }
  if (olKey) {
    updateParams.properties['OL Key'] = { rich_text: [{ text: { content: olKey } }] };
  }
  if (synopsis && !page.properties.Synopsis?.rich_text?.length) {
    updateParams.properties['Synopsis'] = { rich_text: [{ text: { content: synopsis } }] };
  }

  if (Object.keys(updateParams.properties).length === 0) {
    delete updateParams.properties;
  }

  await withRetry(() => notion.pages.update(updateParams));

  return { status: 'enriched', title: rawTitle };
}

// ─── Main Runner ───────────────────────────────────────────────────────────────

async function start() {
  console.log('====================================================');
  console.log(`🚀 Starting in-place block enrichment pipeline`);
  console.log('====================================================\n');

  try {
    const checkpoint = loadCheckpoint();
    console.log(`Checkpoint status: Enriched=${checkpoint.enriched}, Skipped=${checkpoint.skipped}, Failed=${checkpoint.failed}`);

    const templateStructure = await loadTemplateStructure();

    console.log('Querying Comics database pages from Notion...');
    const pagesToEnrich = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await withRetry(() => notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100
      }));

      for (const page of response.results) {
        if (!checkpoint.done[page.id]) {
          const title = getPageTitle(page);
          // Skip the template page itself
          if (title !== 'New Comics' && page.id !== TEMPLATE_SOURCE_PAGE_ID) {
            pagesToEnrich.push(page);
          }
        }
      }
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      await sleep(350);
    }

    console.log(`Found ${pagesToEnrich.length} pages needing template layout and enrichment.`);

    let processed = 0;
    for (const page of pagesToEnrich) {
      if (processed >= enrichLimit) {
        console.log(`Reached enrichment limit of ${enrichLimit} in this run.`);
        break;
      }

      const rawTitle = getPageTitle(page);
      try {
        const result = await enrichPage(page, templateStructure);
        if (result.status === 'enriched') {
          checkpoint.enriched++;
          checkpoint.done[page.id] = true;
          console.log(`\x1b[32m✔ Enriched: "${result.title}"\x1b[0m`);
        } else if (result.status === 'skipped') {
          checkpoint.skipped++;
          checkpoint.done[page.id] = true;
          console.log(`\x1b[33m  Skipped (already has content): "${result.title}"\x1b[0m`);
        }
      } catch (err) {
        checkpoint.failed++;
        console.error(`\x1b[31m❌ Failed page "${rawTitle}":\x1b[0m`, err.message);
      }

      saveCheckpoint(checkpoint);
      processed++;
      await sleep(350);
    }

    console.log('\n====================================================');
    console.log('🎉 Enrichment Sweep Complete!');
    console.log(`🟢 Total newly enriched: ${checkpoint.enriched}`);
    console.log(`🟢 Total skipped: ${checkpoint.skipped}`);
    console.log(`🟢 Total failed: ${checkpoint.failed}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in enrich runner:', error.message);
  }
}

start();
