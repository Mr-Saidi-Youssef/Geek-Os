/**
 * repair_book_covers.js
 * Scans the Notion Library database and upgrades low-resolution covers
 * to high-resolution (large) in place. Also resolves missing covers!
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const BOOKS_DB_ID  = '8b2780bfd84442d8bcd95223152c0ece';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep  = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── CSV Line Parser ──────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped double quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ─── Open Library Fallback Cover Search ───────────────────────────────────────
async function fetchOpenLibraryCover(title, author) {
  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const res = await axios.get(
      `https://openlibrary.org/search.json?q=${query}&limit=1&fields=cover_i`,
      { timeout: 8000 }
    );
    const coverI = res.data?.docs?.[0]?.cover_i;
    if (coverI) {
      return `https://covers.openlibrary.org/b/id/${coverI}-L.jpg`;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchAllPages(databaseId) {
  let results = [];
  let cursor;
  let hasMore = true;
  while (hasMore) {
    const res = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    results = results.concat(res.results);
    hasMore = res.has_more;
    cursor = res.next_cursor;
    await sleep(350);
  }
  return results;
}

async function run() {
  console.log('====================================================');
  console.log('🖼  Starting Books Cover Quality Upgrade Sweep...');
  console.log('====================================================\n');

  // 1. Download Goodreads CSV to build a title -> gr_large_cover map
  console.log('📥 Downloading Goodreads CSV for local high-resolution cover mappings...');
  const grMap = new Map();
  try {
    const csvRes = await axios.get('https://raw.githubusercontent.com/zygmuntz/goodbooks-10k/master/books.csv');
    const lines = csvRes.data.split('\n');
    const headers = parseCSVLine(lines[0]);
    const authorIdx = headers.indexOf('authors');
    const titleIdx = headers.indexOf('title');
    const originalTitleIdx = headers.indexOf('original_title');
    const imageUrlIdx = headers.indexOf('image_url');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const row = parseCSVLine(line);
      if (row.length < headers.length) continue;

      let title = row[originalTitleIdx] ? row[originalTitleIdx].trim() : row[titleIdx].trim();
      if (!title) continue;
      title = title.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();

      const mediumCover = row[imageUrlIdx] ? row[imageUrlIdx].trim() : null;
      if (mediumCover) {
        // Convert to large
        const largeCover = mediumCover.replace(/\/books\/(\d+)[ms]\//, '/books/$1l/');
        grMap.set(title, largeCover);
      }
    }
    console.log(`   ✔ Loaded ${grMap.size} cover maps from Goodreads.\n`);
  } catch (err) {
    console.warn(`   ⚠️  Failed to fetch Goodreads CSV (${err.message}). Falling back to Open Library search.`);
  }

  // 2. Fetch all books from Notion
  console.log('🔍 Fetching all pages in your Notion Books database...');
  const books = await fetchAllPages(BOOKS_DB_ID);
  console.log(`   ✔ Found ${books.length} books in Notion.\n`);

  let upgradedCount = 0;
  let skippedCount  = 0;
  let repairedCount = 0;
  let failedCount   = 0;

  for (let i = 0; i < books.length; i++) {
    const page = books[i];
    
    // Find Title
    let title = '';
    for (const prop of Object.values(page.properties)) {
      if (prop.type === 'title' && prop.title?.length > 0) {
        title = prop.title[0].plain_text.trim();
        break;
      }
    }
    
    // Find Author for fallback search
    let author = 'Unknown';
    if (page.properties.Author?.relation?.length > 0) {
      // We can look up the author name if we cached it, or fallback.
      // Since authors have already been resolved, let's fetch author details if needed.
    }

    const currentCoverUrl = page.cover?.external?.url || page.cover?.file?.url || null;
    const titleKey = title.toLowerCase();

    console.log(`[${i + 1}/${books.length}] Auditing cover for: "${title}"`);

    // A. Check if cover is low-quality Goodreads URL (contains 'm/' or 's/' inside gr-assets)
    const isLowQualityGr = currentCoverUrl && 
      (currentCoverUrl.includes('gr-assets.com') || currentCoverUrl.includes('goodreads.com')) &&
      (/\/books\/(\d+)[ms]\//.test(currentCoverUrl));

    const isMissingCover = !currentCoverUrl;

    if (isLowQualityGr || isMissingCover) {
      let targetCoverUrl = null;

      if (isLowQualityGr) {
        // Upgrade gr-assets URL directly!
        targetCoverUrl = currentCoverUrl.replace(/\/books\/(\d+)[ms]\//, '/books/$1l/');
        console.log(`   🖼  Low-resolution Goodreads cover found. Upgrading to: ${targetCoverUrl}`);
      } else {
        console.log(`   ⚠️  Missing cover detected.`);
        // Try Goodreads map first
        targetCoverUrl = grMap.get(titleKey);
        if (targetCoverUrl) {
          console.log(`   ✔ Found high-resolution cover in Goodreads map: ${targetCoverUrl}`);
        } else {
          // Open Library fallback
          console.log(`   🔍 Searching Open Library for high-resolution cover...`);
          targetCoverUrl = await fetchOpenLibraryCover(title, author);
          if (targetCoverUrl) {
            console.log(`   ✔ Found cover on Open Library: ${targetCoverUrl}`);
          }
        }
      }

      if (targetCoverUrl) {
        // Update cover page in Notion
        let success = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            await notion.pages.update({
              page_id: page.id,
              cover: {
                external: { url: targetCoverUrl }
              }
            });
            success = true;
            break;
          } catch (err) {
            if (err.code === 'rate_limited') {
              console.log(`   ⏳ Rate limited — waiting 60s (attempt ${attempt}/5)...`);
              await sleep(60000);
            } else {
              console.error(`   ❌ Failed to update cover in Notion: ${err.message}`);
              break;
            }
          }
        }

        if (success) {
          if (isLowQualityGr) {
            console.log(`   \x1b[32m✅ Cover upgraded to high-resolution!\x1b[0m`);
            upgradedCount++;
          } else {
            console.log(`   \x1b[32m✅ Cover repaired successfully!\x1b[0m`);
            repairedCount++;
          }
        } else {
          failedCount++;
        }
        await sleep(350);
      } else {
        console.log(`   ❌ Could not resolve cover for this book.`);
        failedCount++;
      }
    } else {
      console.log(`   ⚪ Skipping (cover is already high-resolution or custom)`);
      skippedCount++;
    }
  }

  console.log('\n====================================================');
  console.log('🎉 Books Cover Sweep Complete!');
  console.log(`✅ Covers Upgraded to High-Res: ${upgradedCount}`);
  console.log(`🛠  Missing Covers Repaired:     ${repairedCount}`);
  console.log(`⚪ Already High-Quality:       ${skippedCount}`);
  console.log(`❌ Failed to Resolve:           ${failedCount}`);
  console.log(`📚 Total Books Audited:         ${books.length}`);
  console.log('====================================================\n');
}

run();
