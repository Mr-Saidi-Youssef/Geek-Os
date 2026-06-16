/**
 * Seeder for Manga Library - 10,000 Entries Scale-up
 * Powered by keyless Jikan API (v4) & Official Notion Client
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration validation
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_MANGA_DATABASE_ID || '370d0aaf19d08121a36ff3dfcc914532';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in .env file.\x1b[0m');
  process.exit(1);
}

// Initialize Notion Client
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const importLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10000;

/**
 * Fetch existing items to prevent duplicates (caching MAL ID -> Page ID)
 */
async function fetchNotionCache() {
  console.log('\x1b[36mQuerying Notion database for existing pages to build cache...\x1b[0m');
  const cache = new Map();
  let hasMore = true;
  let startCursor = undefined;
  
  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        const malIdProp = page.properties['MAL ID'];
        if (malIdProp && malIdProp.type === 'number' && malIdProp.number !== null) {
          cache.set(malIdProp.number, page.id);
        }
      }
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
    console.log(`\x1b[32mCache built successfully! Loaded ${cache.size} existing manga items from Notion.\x1b[0m\n`);
    return cache;
  } catch (error) {
    console.error('\x1b[31mError querying Notion database:\x1b[0m', error.message);
    throw error;
  }
}

/**
 * Helper: HTTP GET request with retries for rate limits (429)
 */
async function getWithRetry(url, params = {}, retries = 5, delayMs = 3000) {
  try {
    return await axios.get(url, { params });
  } catch (error) {
    if (error.response && (error.response.status === 429 || error.response.status >= 500) && retries > 0) {
      console.warn(`\x1b[33m  [Jikan API Limit] Waiting ${delayMs}ms before retrying (Retries left: ${retries})...\x1b[0m`);
      await sleep(delayMs);
      return getWithRetry(url, params, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

/**
 * Helper: Notion page creation with automatic retries for rate limits (429)
 */
async function createPageWithRetry(pageParams, retries = 5, delayMs = 3000) {
  try {
    return await notion.pages.create(pageParams);
  } catch (error) {
    if ((error.status === 429 || error.message.includes('429') || error.message.toLowerCase().includes('rate')) && retries > 0) {
      console.warn(`\x1b[33m  [Notion Rate Limit] Waiting ${delayMs}ms before retrying page creation (Retries left: ${retries})...\x1b[0m`);
      await sleep(delayMs);
      return createPageWithRetry(pageParams, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

/**
 * Import single manga item to Notion
 */
async function importMangaToNotion(manga, existingCache) {
  const malId = manga.mal_id;
  const title = manga.title_english || manga.title || 'Unknown Title';
  const url = manga.url;
  
  let coverUrl = '';
  if (manga.images) {
    coverUrl = manga.images.webp?.large_image_url || manga.images.jpg?.large_image_url || manga.images.jpg?.image_url;
  }

  const chapters = manga.chapters || null;
  const volumes = manga.volumes || null;
  const globalScore = manga.score || null;
  const publishingStatus = manga.status || '';

  let genres = [];
  if (manga.genres && Array.isArray(manga.genres)) {
    genres = manga.genres.map(g => g.name).filter(Boolean);
  }

  let authors = [];
  if (manga.authors && Array.isArray(manga.authors)) {
    authors = manga.authors.map(a => a.name).filter(Boolean);
  }

  const synopsis = manga.synopsis || '';

  const cachedPageId = existingCache.get(malId);

  if (cachedPageId) {
    // Already in Notion, skip insert
    return false;
  }

  if (dryRun) {
    console.log(`[Dry Run] Would insert: "${title}" (MAL Score: ${globalScore || 'N/A'}, Authors: ${authors.join(', ')})`);
    return true;
  }

  const properties = {
    'Title': {
      title: [{ text: { content: title } }]
    },
    'MAL ID': { number: malId },
    'Status': { status: { name: 'Not started' } }, // Status property type
    'MAL URL': { url: url }
  };

  // Add optional metadata fields
  if (coverUrl) {
    properties['Cover Image'] = {
      files: [{ name: 'Cover Image', type: 'external', external: { url: coverUrl } }]
    };
  }

  if (chapters !== null) {
    properties['Chapters'] = { number: chapters };
  }

  if (volumes !== null) {
    properties['Volumes'] = { number: volumes };
  }

  if (publishingStatus) {
    properties['PublishingStatus'] = { select: { name: publishingStatus } };
  }

  if (globalScore !== null) {
    properties['MAL Score'] = { number: globalScore };
  }

  if (authors.length > 0) {
    properties['Authors'] = {
      rich_text: [{ text: { content: authors.join(', ').substring(0, 2000) } }]
    };
  }

  if (genres.length > 0) {
    properties['Genres'] = {
      multi_select: genres.map(g => ({ name: g.substring(0, 100) }))
    };
  }

  if (synopsis) {
    properties['Synopsis'] = {
      rich_text: [{ text: { content: synopsis.substring(0, 1900) } }]
    };
  }

  const pageData = {
    parent: { database_id: DATABASE_ID },
    properties: properties
  };

  if (coverUrl) {
    pageData.cover = {
      type: 'external',
      external: { url: coverUrl }
    };
  }

  try {
    await createPageWithRetry(pageData);
    console.log(`\x1b[32m[Inserted] "${title}" (MAL Score: ${globalScore || 'N/A'})\x1b[0m`);
    return true;
  } catch (err) {
    console.error(`\x1b[31m  Failed to create page for "${title}":\x1b[0m`, err.message);
    return false;
  }
}

/**
 * Execute Seed Process
 */
async function start() {
  const targetCount = importLimit;
  const itemsPerPage = 25;
  const pagesNeeded = Math.ceil(targetCount / itemsPerPage); // up to 400 pages

  console.log('====================================================');
  console.log(`🚀 Seeding Notion with Top ${targetCount} Manga Master Catalog ${dryRun ? '(DRY RUN)' : ''}`);
  console.log('====================================================\n');

  try {
    const existingCache = await fetchNotionCache();
    let currentTotal = existingCache.size;
    console.log(`Current size: ${currentTotal} entries in database.\n`);

    if (currentTotal >= targetCount) {
      console.log(`\x1b[32mManga Database is already at ${currentTotal} items (Goal of ${targetCount} reached!). Skipping execution.\x1b[0m`);
      return;
    }

    let newlyImported = 0;
    
    // Loop through Jikan top/manga pages
    for (let pageNum = 1; pageNum <= pagesNeeded; pageNum++) {
      console.log(`\n\x1b[36m--- Fetching page ${pageNum}/${pagesNeeded} from Jikan API ---\x1b[0m`);
      const url = `https://api.jikan.moe/v4/top/manga`;
      
      let response;
      try {
        response = await getWithRetry(url, { page: pageNum });
      } catch (err) {
        console.error(`\x1b[31mFailed to fetch page ${pageNum} from Jikan after retries. Skipping page.\x1b[0m`, err.message);
        await sleep(4000);
        continue;
      }

      if (!response.data || !response.data.data || response.data.data.length === 0) {
        console.log('No manga returned or end of data reached.');
        break;
      }

      const mangaList = response.data.data;
      console.log(`Loaded ${mangaList.length} items from Jikan page ${pageNum}.`);

      for (const manga of mangaList) {
        if (currentTotal >= targetCount) {
          console.log(`\x1b[32m✔ Target collection size of ${targetCount} items reached!\x1b[0m`);
          break;
        }

        const success = await importMangaToNotion(manga, existingCache);
        if (success) {
          newlyImported++;
          currentTotal++;
          existingCache.set(manga.mal_id, true); // add to cache
          
          if (!dryRun) {
            // Respect Notion rate limits: wait 350ms between inserts
            await sleep(350);
          }
        }
      }

      if (currentTotal >= targetCount) {
        break;
      }

      // Respect Jikan rate limits: wait 1500ms between page queries
      console.log(`Waiting 1.5s for Jikan rate limit safety...`);
      await sleep(1500);
    }

    console.log('\n====================================================');
    console.log('🎉 Seeding Sweep Complete!');
    console.log(`🟢 Total Manga currently in Notion: ${currentTotal}`);
    console.log(`🟢 Newly imported in this run: ${newlyImported}`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Critical error in Manga seeder:', err.message);
  }
}

start();
