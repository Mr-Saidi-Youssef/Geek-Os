/**
 * Repair Comics Covers using Open Library
 * Replaces broken weserv.nl/Goodreads proxy URLs with working Open Library cover images.
 * Uses the OL Key property already populated on each page.
 *
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_COMICS_DATABASE_ID || '371d0aaf19d081c59b14fbc0c52b0040';
const CHECKPOINT_FILE = path.join(__dirname, 'repair_comic_covers_ol_checkpoint.json');
const MAX_RETRIES = 12;

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in .env\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const DO_RESET = process.argv.includes('--reset');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry(fn, retries = MAX_RETRIES, label = '') {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.status === 429 || err?.code === 'rate_limited' || err?.message?.includes('429');
      const isTransient = err?.status >= 500;
      if ((is429 || isTransient) && attempt < retries) {
        const waitSec = Math.pow(2, attempt) * 3 + 5;
        console.log(`  ⏳ Rate limited${label ? ` (${label})` : ''} — waiting ${waitSec}s (attempt ${attempt + 1}/${retries})...`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
}

function loadCheckpoint() {
  if (DO_RESET && fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
    console.log('🔄 Checkpoint cleared.\n');
  }
  if (!fs.existsSync(CHECKPOINT_FILE)) return { done: {}, repaired: 0, alreadyOk: 0, noKey: 0, failed: 0 };
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
  } catch (_) {
    return { done: {}, repaired: 0, alreadyOk: 0, noKey: 0, failed: 0 };
  }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp, null, 2), 'utf8');
}

function getPageTitle(page) {
  for (const [, v] of Object.entries(page.properties)) {
    if (v.type === 'title') return v.title.map(t => t.plain_text).join('').trim();
  }
  return '(Untitled)';
}

/**
 * Try multiple Open Library cover strategies in order of quality:
 * 1. Works cover by OL Key (highest quality)
 * 2. Search by title for ISBN-based cover
 * 3. Fallback to search cover ID
 */
async function findWorkingCoverUrl(olKey, title) {
  // Strategy 1: Works cover via OL Key (best quality, most reliable)
  if (olKey) {
    const worksUrl = `https://covers.openlibrary.org/b/olid/${olKey}-L.jpg`;
    try {
      const res = await axios.head(worksUrl, { timeout: 6000, maxRedirects: 5 });
      const contentLength = parseInt(res.headers['content-length'] || '0');
      // OL returns a tiny 1x1 placeholder if no cover exists — filter those out
      if (res.status === 200 && contentLength > 1000) {
        return worksUrl;
      }
    } catch (_) {}
  }

  // Strategy 2: Search for ISBN and use ISBN cover
  try {
    const searchRes = await axios.get('https://openlibrary.org/search.json', {
      params: { q: title, limit: 3 },
      timeout: 8000
    });
    const docs = searchRes.data?.docs || [];
    
    for (const doc of docs) {
      // Try cover_i (cover ID)
      if (doc.cover_i) {
        const coverIdUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
        return coverIdUrl;
      }
      
      // Try ISBN
      if (doc.isbn && doc.isbn.length > 0) {
        const isbn = doc.isbn[0];
        const isbnUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
        try {
          const check = await axios.head(isbnUrl, { timeout: 5000 });
          const cl = parseInt(check.headers['content-length'] || '0');
          if (check.status === 200 && cl > 1000) {
            return isbnUrl;
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  return null;
}

async function start() {
  console.log('====================================================');
  console.log('🖼️  Comics Cover Repair — Open Library');
  console.log('    Replacing broken weserv/Goodreads covers with OL');
  console.log('====================================================\n');

  const checkpoint = loadCheckpoint();
  console.log(`Checkpoint: Repaired=${checkpoint.repaired}, OK=${checkpoint.alreadyOk}, No key=${checkpoint.noKey}, Failed=${checkpoint.failed}\n`);

  // 1. Query all pages
  console.log('Querying Comics database...');
  const allPages = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const response = await withRetry(() => notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: startCursor,
      page_size: 100
    }));

    for (const page of response.results) {
      const title = getPageTitle(page);
      if (title !== 'New Comics' && !checkpoint.done[page.id]) {
        allPages.push(page);
      }
    }
    hasMore = response.has_more;
    startCursor = response.next_cursor;
    await sleep(350);
  }

  console.log(`Found ${allPages.length} pages to check.\n`);

  // 2. Process each page
  for (const page of allPages) {
    const title = getPageTitle(page);
    const olKey = page.properties['OL Key']?.rich_text?.map(t => t.plain_text).join('') || null;
    const currentCover = page.cover?.external?.url || page.cover?.file?.url || '';
    
    // Check if current cover is broken (weserv proxy or empty)
    const isBroken = !currentCover || currentCover.includes('images.weserv.nl') || currentCover.includes('goodreads.com');
    
    if (!isBroken) {
      // Cover looks fine already (not a weserv proxy)
      checkpoint.alreadyOk++;
      checkpoint.done[page.id] = true;
      saveCheckpoint(checkpoint);
      console.log(`  ✅ "${title}" — cover looks OK`);
      continue;
    }

    if (!olKey) {
      checkpoint.noKey++;
      checkpoint.done[page.id] = true;
      saveCheckpoint(checkpoint);
      console.log(`\x1b[33m  ⚠ "${title}" — no OL Key, skipping\x1b[0m`);
      continue;
    }

    try {
      const newCoverUrl = await findWorkingCoverUrl(olKey, title);
      
      if (!newCoverUrl) {
        checkpoint.noKey++;
        checkpoint.done[page.id] = true;
        saveCheckpoint(checkpoint);
        console.log(`\x1b[33m  ⚠ "${title}" — no working cover found on OL\x1b[0m`);
        continue;
      }

      // Update both page cover and Cover Image property
      await withRetry(() => notion.pages.update({
        page_id: page.id,
        cover: {
          type: 'external',
          external: { url: newCoverUrl }
        },
        properties: {
          'Cover Image': {
            files: [{
              name: 'Cover',
              type: 'external',
              external: { url: newCoverUrl }
            }]
          }
        }
      }), MAX_RETRIES, title);

      checkpoint.repaired++;
      checkpoint.done[page.id] = true;
      saveCheckpoint(checkpoint);
      console.log(`\x1b[32m  ✔ "${title}" — cover repaired → ${newCoverUrl}\x1b[0m`);

    } catch (err) {
      checkpoint.failed++;
      checkpoint.done[page.id] = true;
      saveCheckpoint(checkpoint);
      console.error(`\x1b[31m  ❌ "${title}" — error: ${err.message}\x1b[0m`);
    }

    await sleep(500);
  }

  console.log('\n====================================================');
  console.log('🖼️  Comics Cover Repair Complete!');
  console.log(`  🟢 Repaired:     ${checkpoint.repaired}`);
  console.log(`  ✅ Already OK:   ${checkpoint.alreadyOk}`);
  console.log(`  ⚠️  No cover:     ${checkpoint.noKey}`);
  console.log(`  ❌ Failed:        ${checkpoint.failed}`);
  console.log('====================================================\n');
}

start();
