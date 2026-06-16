/**
 * Seed Notion Database with Top Anime Master Catalog
 * Powered by Jikan API (v4) & Official Notion Client
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration validation
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN || NOTION_TOKEN.includes('your_notion_integration_token_here')) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in .env file.\x1b[0m');
  process.exit(1);
}
if (!DATABASE_ID || DATABASE_ID.includes('your_database_id_here')) {
  console.error('\x1b[31mError: NOTION_DATABASE_ID is not set in .env file.\x1b[0m');
  process.exit(1);
}

// Initialize Notion Client
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Ratings Select Mapper
function mapRating(score) {
  if (!score || score === 0) return null;
  const ratingLabels = {
    10: '⭐ 10 - Masterpiece',
    9: '⭐ 9 - Great',
    8: '⭐ 8 - Very Good',
    7: '⭐ 7 - Good',
    6: '⭐ 6 - Fine',
    5: '⭐ 5 - Average',
    4: '⭐ 4 - Bad',
    3: '⭐ 3 - Very Bad',
    2: '⭐ 2 - Horrible',
    1: '⭐ 1 - Appalling'
  };
  const rounded = Math.round(score);
  return ratingLabels[rounded] || null;
}

/**
 * Fetch existing items to prevent duplicates
 */
async function fetchNotionCache() {
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
    return cache;
  } catch (error) {
    console.error('\x1b[31mError querying Notion database:\x1b[0m', error.message);
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
    console.log(`\x1b[90m[Skipped] "${title}" — Already exists inside database.\x1b[0m`);
    return false;
  }

  const properties = {
    'Title': {
      title: [{ text: { content: title } }]
    },
    'MAL ID': { number: malId },
    'Status': { select: { name: 'Plan to Watch' } }, // default state for catalog items
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
    properties['Format'] = { select: { name: format } };
  }

  if (globalScore !== null) {
    properties['MAL Score'] = { number: globalScore };
  }

  if (studio) {
    properties['Studio'] = { select: { name: studio } };
  }

  if (genres.length > 0) {
    properties['Genres'] = {
      multi_select: genres.map(g => ({ name: g }))
    };
  }

  if (synopsis) {
    properties['Synopsis'] = {
      rich_text: [{ text: { content: synopsis.substring(0, 1900) } }]
    };
  }

  console.log(`\x1b[32m[Inserting] "${title}" (MAL Score: ${globalScore || 'N/A'})\x1b[0m`);
  
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
  // We can specify limit via command line argument, default to 100
  const limitArg = parseInt(process.argv[2], 10);
  const targetCount = !isNaN(limitArg) && limitArg > 0 ? limitArg : 100;
  
  const itemsPerPage = 25;
  const pagesNeeded = Math.ceil(targetCount / itemsPerPage);

  console.log('====================================================');
  console.log(`🚀 Seeding Notion with Top ${targetCount} Anime Master Catalog`);
  console.log('====================================================\n');

  try {
    const existingCache = await fetchNotionCache();
    console.log(`Loaded ${existingCache.size} existing items from Notion.\n`);

    let importedCount = 0;
    let itemsFetched = [];

    // 1. Fetch Top Anime from Jikan
    console.log(`Fetching ${targetCount} top anime entries from MyAnimeList...`);
    for (let page = 1; page <= pagesNeeded; page++) {
      try {
        console.log(`  Retrieving page ${page}/${pagesNeeded}...`);
        const res = await axios.get('https://api.jikan.moe/v4/top/anime', {
          params: { page, filter: 'bypopularity' } // sort by popularity to get the most famous ones!
        });
        
        if (res.data && res.data.data) {
          itemsFetched = itemsFetched.concat(res.data.data);
          // Wait to respect rate limits
          await sleep(1500);
        }
      } catch (err) {
        console.error(`\x1b[31m  Failed to fetch top anime page ${page}:\x1b[0m`, err.message);
        break;
      }
    }

    // Slice to target count
    const itemsToImport = itemsFetched.slice(0, targetCount);
    console.log(`\nStarting sync of ${itemsToImport.length} anime entries into Notion...`);

    // 2. Sync to Notion
    for (const anime of itemsToImport) {
      const success = await importAnimeToNotion(anime, existingCache);
      if (success) {
        importedCount++;
        // Small delay to prevent hitting Notion API limits
        await sleep(350);
      }
    }

    console.log('\n====================================================');
    console.log('\x1b[32m🎉 Master Catalog Seeding Finished!\x1b[0m');
    console.log(`🟢 Successfully Imported: ${importedCount} new anime cards.`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in execution:', error.message);
  }
}

start();
