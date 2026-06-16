/**
 * Import Anime into Notion by Title Search
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
  // Handle decimal scores from global average (rounding to nearest integer)
  const rounded = Math.round(score);
  return ratingLabels[rounded] || null;
}

// Watch Status Selector Mapper
function mapStatus(statusRaw) {
  if (!statusRaw) return 'Plan to Watch';
  const s = statusRaw.toLowerCase().replace(/[^a-z]/g, '');
  if (s.includes('watching')) return 'Watching';
  if (s.includes('completed')) return 'Completed';
  if (s.includes('hold')) return 'On Hold';
  if (s.includes('dropped')) return 'Dropped';
  return 'Plan to Watch';
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
 * Search anime by title on Jikan API
 */
async function searchAnimeOnMAL(title) {
  console.log(`\x1b[34mSearching MyAnimeList for: "${title}"...\x1b[0m`);
  try {
    const res = await axios.get('https://api.jikan.moe/v4/anime', {
      params: { q: title, limit: 1 }
    });

    if (res.data && res.data.data && res.data.data.length > 0) {
      return res.data.data[0];
    }
    console.log(`\x1b[33m  No results found for "${title}" on MyAnimeList.\x1b[0m`);
    return null;
  } catch (err) {
    if (err.response && err.response.status === 429) {
      console.warn('\x1b[33m  Rate limited by Jikan. Waiting 3 seconds before retrying search...\x1b[0m');
      await sleep(3000);
      return searchAnimeOnMAL(title); // Retry
    }
    console.error(`\x1b[31m  Error searching MAL for "${title}":\x1b[0m`, err.message);
    return null;
  }
}

/**
 * Import or Update page in Notion
 */
async function importAnimeToNotion(anime, existingCache, statusOverride = 'Plan to Watch') {
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

  const properties = {
    'Title': {
      title: [{ text: { content: title } }]
    },
    'MAL ID': { number: malId },
    'Status': { select: { name: statusOverride } },
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

  if (cachedPageId) {
    // Perform Update
    console.log(`\x1b[33m[Updating] "${title}" (MAL ID: ${malId}) inside Notion...\x1b[0m`);
    try {
      await notion.pages.update({
        page_id: cachedPageId,
        properties: properties
      });
      console.log(`\x1b[32m  Successfully updated: "${title}"\x1b[0m`);
      return true;
    } catch (err) {
      console.error(`\x1b[31m  Failed to update page for "${title}":\x1b[0m`, err.message);
      return false;
    }
  } else {
    // Perform Insert (Create New Page)
    console.log(`\x1b[32m[Inserting] "${title}" (MAL ID: ${malId}) into Notion...\x1b[0m`);
    
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
      console.log(`\x1b[32m  Successfully created page for: "${title}"\x1b[0m`);
      return true;
    } catch (err) {
      console.error(`\x1b[31m  Failed to create page for "${title}":\x1b[0m`, err.message);
      return false;
    }
  }
}

/**
 * Execute imports from console arguments
 */
async function start() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('\n\x1b[31mUsage: node import_by_title.js "Anime Name 1" "Anime Name 2" ...\x1b[0m');
    console.log('Example: node import_by_title.js "Frieren" "Attack on Titan"\n');
    process.exit(0);
  }

  console.log('====================================================');
  console.log('\x1b[35m🚀 Importing Anime into Notion via Search\x1b[0m');
  console.log('====================================================\n');

  try {
    const existingCache = await fetchNotionCache();
    console.log(`Loaded ${existingCache.size} existing items from Notion.\n`);

    for (const animeTitle of args) {
      const anime = await searchAnimeOnMAL(animeTitle);
      if (anime) {
        await importAnimeToNotion(anime, existingCache);
        // Wait 1.5 seconds to comply with Jikan rate limits
        await sleep(1500);
      }
    }

    console.log('\n====================================================');
    console.log('\x1b[32m🎉 Import batch execution finished!\x1b[0m');
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in execution:', error.message);
  }
}

start();
