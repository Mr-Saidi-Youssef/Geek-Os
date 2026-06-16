/**
 * Seeder for Anime Watchlist - 10,000 Entries Scale-up
 * Powered by keyless Jikan API (v4) & Official Notion Client
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration validation
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID || '36dd0aaf19d0800792e7dca0434c570c';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in .env file.\x1b[0m');
  process.exit(1);
}

// Initialize Notion Client
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    console.log(`\x1b[32mCache built successfully! Loaded ${cache.size} existing anime items from Notion.\x1b[0m\n`);
    return cache;
  } catch (error) {
    console.error('\x1b[31mError querying Notion database:\x1b[0m', error.message);
    throw error;
  }
}

/**
 * Helper: HTTP GET request with retries for rate limits (429)
 */
async function getWithRetry(url, params = {}, retries = 3, delayMs = 2000) {
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
 * Import single anime item to Notion
 */
async function importAnimeToNotion(anime, existingCache) {
  const malId = anime.mal_id;
  const title = anime.title_english || anime.title || 'Unknown Title';
  const url = anime.url;
  
  let coverUrl = '';
  if (anime.images) {
    coverUrl = anime.images.webp?.large_image_url || anime.images.jpg?.large_image_url || anime.images.jpg?.image_url;
  }

  const format = anime.type || '';
  const totalEpisodes = anime.episodes || null;
  const globalScore = anime.score || null;

  let genres = [];
  if (anime.genres && Array.isArray(anime.genres)) {
    genres = anime.genres.map(g => g.name).filter(Boolean);
  }

  let studio = '';
  if (anime.studios && Array.isArray(anime.studios) && anime.studios.length > 0) {
    studio = anime.studios[0].name;
  }

  const synopsis = anime.synopsis || '';

  const cachedPageId = existingCache.get(malId);

  if (cachedPageId) {
    // Already in Notion, skip insert
    return false;
  }

  const properties = {
    'Title': {
      title: [{ text: { content: title } }]
    },
    'MAL ID': { number: malId },
    'Status': { status: { name: 'Inbox' } }, // Status (status type) -> "Inbox" verified!
    'MAL URL': { url: url }
  };

  // Add optional metadata fields
  if (coverUrl) {
    properties['Cover Image'] = {
      files: [{ name: 'Cover Image', type: 'external', external: { url: coverUrl } }]
    };
  }

  if (totalEpisodes !== null) {
    properties['Total Episodes'] = { number: totalEpisodes };
  }

  if (format) {
    // Ensure format is a valid select (e.g. TV, Movie, OVA, Special, ONA, Music)
    properties['Format'] = { select: { name: format } };
  }

  if (globalScore !== null) {
    properties['MAL Score'] = { number: globalScore };
  }

  if (studio) {
    properties['Studio'] = { select: { name: studio.substring(0, 100) } };
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
    await notion.pages.create(pageData);
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
  const targetCount = 10000;
  const itemsPerPage = 25;
  const pagesNeeded = Math.ceil(targetCount / itemsPerPage); // 400 pages

  console.log('====================================================');
  console.log(`🚀 Seeding Notion with Top ${targetCount} Anime Master Catalog`);
  console.log('====================================================\n');

  try {
    const existingCache = await fetchNotionCache();
    let currentTotal = existingCache.size;
    console.log(`Current size: ${currentTotal} entries in database.\n`);

    if (currentTotal >= targetCount) {
      console.log(`\x1b[32mAnime Database is already at ${currentTotal} items (Goal of ${targetCount} reached!). Skipping execution.\x1b[0m`);
      return;
    }

    let newlyImported = 0;
    
    // Fetch and Sync page by page to save RAM, handle rate limits and support crashes/interruptions gracefully
    for (let page = 1; page <= pagesNeeded; page++) {
      if (currentTotal + newlyImported >= targetCount) {
        console.log(`\x1b[32mGoal of ${targetCount} items reached! Exiting...\x1b[0m`);
        break;
      }

      console.log(`\n\x1b[35m[Page ${page}/${pagesNeeded}] Fetching top anime from MyAnimeList...\x1b[0m`);
      
      let res;
      try {
        res = await getWithRetry('https://api.jikan.moe/v4/top/anime', {
          page: page,
          filter: 'bypopularity' // ordered by popularity to get the most famous anime first!
        });
      } catch (err) {
        console.error(`\x1b[31mFailed to fetch page ${page} after retries:\x1b[0m`, err.message);
        console.log('Waiting 10 seconds before skipping to next page...');
        await sleep(10000);
        continue;
      }

      if (!res.data || !res.data.data || res.data.data.length === 0) {
        console.log('No anime items returned on this page. Skipping.');
        await sleep(2000);
        continue;
      }

      console.log(`Fetched ${res.data.data.length} anime entries. Syncing to Notion...`);

      for (const anime of res.data.data) {
        if (currentTotal + newlyImported >= targetCount) break;

        const success = await importAnimeToNotion(anime, existingCache);
        if (success) {
          newlyImported++;
          // Add to cache so we don't try to insert it again in the same run if duplicates exist
          existingCache.set(anime.mal_id, true);
          // Rate-limiting: Notion allows 3 write requests per second (350ms delay)
          await sleep(350);
        }
      }

      console.log(`Progress: ${currentTotal + newlyImported}/${targetCount} items in database.`);
      
      // Delay between Jikan API calls (Jikan requires at least 1s rate-limit delay keyless)
      await sleep(1500);
    }

    console.log('\n====================================================');
    console.log('\x1b[32m🎉 Anime Watchlist Seeding Phase Finished!\x1b[0m');
    console.log(`🟢 Successfully Imported: ${newlyImported} new anime cards.`);
    console.log(`⚪ Total Database Size: ${currentTotal + newlyImported} cards.`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in execution:', error.message);
  }
}

start();
