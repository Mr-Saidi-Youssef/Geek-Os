/**
 * MyAnimeList to Notion Database Syncer
 * Powered by Jikan API (v4) & Official Notion Client
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration validation
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;
const MAL_USERNAME = process.env.MAL_USERNAME;

if (!NOTION_TOKEN || NOTION_TOKEN.includes('your_notion_integration_token_here')) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set or is using the default placeholder in .env file.\x1b[0m');
  process.exit(1);
}
if (!DATABASE_ID || DATABASE_ID.includes('your_database_id_here')) {
  console.error('\x1b[31mError: NOTION_DATABASE_ID is not set or is using the default placeholder in .env file.\x1b[0m');
  process.exit(1);
}
if (!MAL_USERNAME || MAL_USERNAME.includes('your_myanimelist_username_here')) {
  console.error('\x1b[31mError: MAL_USERNAME is not set or is using the default placeholder in .env file.\x1b[0m');
  process.exit(1);
}

// Initialize official Notion SDK client
const notion = new Client({ auth: NOTION_TOKEN });

// Utility: sleep delay function (async setTimeout)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Utility: Rating Map (MAL Score 1-10 -> Notion Star representation)
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
  return ratingLabels[score] || null;
}

// Utility: Status Map (MAL string -> Notion Database Status select option)
function mapStatus(statusRaw) {
  if (!statusRaw) return 'Plan to Watch';
  const s = statusRaw.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s === 'watching') return 'Watching';
  if (s === 'completed') return 'Completed';
  if (s === 'onhold' || s === 'on_hold') return 'On Hold';
  if (s === 'dropped') return 'Dropped';
  if (s === 'plantowatch' || s === 'plan_to_watch') return 'Plan to Watch';
  return 'Plan to Watch';
}

/**
 * Fetch all existing anime items in the Notion database.
 * Builds an in-memory cache to prevent duplicate inserts and implement smart sync updates.
 */
async function fetchNotionCache() {
  console.log('\x1b[36mQuerying Notion database to build existing item cache...\x1b[0m');
  const cache = new Map();
  let hasMore = true;
  let startCursor = undefined;
  let count = 0;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        count++;
        const malIdProp = page.properties['MAL ID'];
        if (malIdProp && malIdProp.type === 'number' && malIdProp.number !== null) {
          cache.set(malIdProp.number, {
            pageId: page.id,
            episodesWatched: page.properties['Episodes Watched']?.number || 0,
            status: page.properties['Status']?.select?.name || '',
            myRating: page.properties['My Rating']?.select?.name || null,
          });
        }
      }
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
    console.log(`\x1b[32mCache built successfully! Cached ${cache.size} anime from ${count} total pages.\x1b[0m\n`);
    return cache;
  } catch (error) {
    console.error('\x1b[31mError querying Notion database:\x1b[0m', error.message);
    throw error;
  }
}

/**
 * Robust item parsing utility that handles different schemas safely.
 */
function parseJikanItem(item) {
  // Extract main anime details node
  // Jikan v4 typically uses "anime" or "entry" or embeds them at the root level
  const node = item.anime || item.entry || item.node || item;
  const malId = node.mal_id || node.id;
  
  if (!malId) {
    throw new Error('Could not find mal_id in the Jikan item node.');
  }

  const title = node.title || (node.titles && node.titles[0]?.title) || 'Unknown Title';
  const url = node.url || `https://myanimelist.net/anime/${malId}`;
  
  // Direct WebP/JPG Cover extractor
  let coverUrl = '';
  if (node.images) {
    coverUrl = node.images.webp?.large_image_url || node.images.jpg?.large_image_url || node.images.webp?.image_url || node.images.jpg?.image_url;
  } else if (node.main_picture) {
    coverUrl = node.main_picture.large || node.main_picture.medium;
  }

  // User-specific watchlist stats
  const listStatus = item.list_status || item;
  const userScore = item.score !== undefined ? item.score : (listStatus.score || 0);
  const watchStatusRaw = item.status !== undefined ? item.status : (listStatus.status || '');
  const episodesWatched = item.episodes_watched !== undefined 
    ? item.episodes_watched 
    : (item.progress !== undefined ? item.progress : (listStatus.num_episodes_watched || 0));

  // Global Anime properties
  const format = node.type || node.format || ''; // e.g. TV, Movie, OVA, Special
  const totalEpisodes = node.episodes !== undefined ? node.episodes : (node.num_episodes || null);
  const globalScore = node.score || null;

  // Studios & Genres
  let genres = [];
  if (node.genres && Array.isArray(node.genres)) {
    genres = node.genres.map(g => g.name).filter(Boolean);
  }

  let studio = '';
  if (node.studios && Array.isArray(node.studios) && node.studios.length > 0) {
    studio = node.studios[0].name;
  }

  const synopsis = node.synopsis || '';

  return {
    malId,
    title,
    url,
    coverUrl,
    userScore,
    watchStatusRaw,
    episodesWatched,
    format,
    totalEpisodes,
    globalScore,
    genres,
    studio,
    synopsis
  };
}

/**
 * Fetch MyAnimeList items for the user, supporting pagination.
 */
async function fetchMALList() {
  let allItems = [];
  let page = 1;
  let hasMore = true;

  // Read status filters from environment, if any
  const statusFilterConfig = process.env.SYNC_STATUSES || '';
  const statuses = statusFilterConfig
    ? statusFilterConfig.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : ['']; // empty string means fetch all

  for (const status of statuses) {
    hasMore = true;
    page = 1;
    
    // Map env filter to Jikan parameter: "watching" | "completed" | "onhold" | "dropped" | "plantowatch"
    let jikanStatusParam = '';
    if (status) {
      jikanStatusParam = status;
      if (status === 'on_hold') jikanStatusParam = 'onhold';
      if (status === 'plan_to_watch') jikanStatusParam = 'plantowatch';
    }

    console.log(`\x1b[34mInitiating MyAnimeList pull for user "${MAL_USERNAME}" [Filter: ${status || 'All'}]...\x1b[0m`);

    while (hasMore) {
      const url = `https://api.jikan.moe/v4/users/${MAL_USERNAME}/animelist`;
      const params = { page };
      if (jikanStatusParam) {
        params.status = jikanStatusParam;
      }

      try {
        console.log(`  Fetching page ${page}...`);
        const response = await axios.get(url, { params });
        const resData = response.data;

        if (resData && resData.data && resData.data.length > 0) {
          allItems = allItems.concat(resData.data);
          
          // Pagination check
          if (resData.pagination && resData.pagination.has_next_page) {
            page++;
            // Jikan API limit is 3 requests per second. Sleep for safety.
            await sleep(1500);
          } else {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      } catch (err) {
        if (err.response && err.response.status === 429) {
          console.warn('\x1b[33m  Rate limit warning (429). Waiting 5 seconds before retrying page...\x1b[0m');
          await sleep(5000);
          continue; // Retry page fetch
        }
        console.error(`\x1b[31m  Failed to fetch MyAnimeList for page ${page}:\x1b[0m`, err.message);
        hasMore = false;
      }
    }
  }

  // Remove duplicate entries that might occur if multiple status pulls intersect
  const uniqueItems = [];
  const seenIds = new Set();
  for (const item of allItems) {
    try {
      const parsed = parseJikanItem(item);
      if (!seenIds.has(parsed.malId)) {
        seenIds.add(parsed.malId);
        uniqueItems.push(item);
      }
    } catch (e) {
      // Skip faulty items
    }
  }

  console.log(`\x1b[32mSuccessfully fetched and filtered ${uniqueItems.length} unique anime entries from MyAnimeList.\x1b[0m\n`);
  return uniqueItems;
}

/**
 * Creates or updates an anime entry in the Notion watchlist database
 */
async function syncItemToNotion(item, existingCache) {
  let parsed;
  try {
    parsed = parseJikanItem(item);
  } catch (error) {
    console.error('\x1b[31mFailed to parse MyAnimeList item structure:\x1b[0m', error.message);
    return { type: 'failed', title: 'Unknown' };
  }

  const {
    malId,
    title,
    url,
    coverUrl,
    userScore,
    watchStatusRaw,
    episodesWatched,
    format,
    totalEpisodes,
    globalScore,
    genres,
    studio,
    synopsis
  } = parsed;

  const targetStatus = mapStatus(watchStatusRaw);
  const targetRating = mapRating(userScore);

  // Check if item is already inside Notion database cache
  const cachedItem = existingCache.get(malId);

  if (cachedItem) {
    // Check if anything has actually changed to optimize Notion API quotas
    const noChanges = 
      cachedItem.episodesWatched === episodesWatched &&
      cachedItem.status === targetStatus &&
      cachedItem.myRating === targetRating;

    if (noChanges) {
      console.log(`\x1b[90m[Skipped] "${title}" — Up to date.\x1b[0m`);
      return { type: 'skipped', title };
    }

    // Perform Update
    console.log(`\x1b[33m[Updating] "${title}" — Progress: ${cachedItem.episodesWatched}/${cachedItem.status} -> ${episodesWatched}/${targetStatus}\x1b[0m`);
    
    const properties = {
      'Status': { select: { name: targetStatus } },
      'Episodes Watched': { number: episodesWatched }
    };

    if (targetRating) {
      properties['My Rating'] = { select: { name: targetRating } };
    } else {
      properties['My Rating'] = { select: null };
    }

    // Also update basic statistics if they changed (in case total episodes updated or average score changed)
    if (totalEpisodes !== null) {
      properties['Total Episodes'] = { number: totalEpisodes };
    }
    if (globalScore !== null) {
      properties['MAL Score'] = { number: globalScore };
    }

    try {
      await notion.pages.update({
        page_id: cachedItem.pageId,
        properties: properties
      });
      return { type: 'updated', title };
    } catch (err) {
      console.error(`\x1b[31m  Failed to update page for "${title}":\x1b[0m`, err.message);
      return { type: 'error', title };
    }

  } else {
    // Perform Insert (Create New Page)
    console.log(`\x1b[32m[Inserting] "${title}" (MAL ID: ${malId})\x1b[0m`);

    const properties = {
      'Title': {
        title: [
          {
            text: {
              content: title
            }
          }
        ]
      },
      'MAL ID': { number: malId },
      'Status': { select: { name: targetStatus } },
      'Episodes Watched': { number: episodesWatched },
      'MAL URL': { url: url }
    };

    // Add optional properties safely
    if (coverUrl) {
      properties['Cover Image'] = {
        files: [
          {
            name: 'Cover Image',
            type: 'external',
            external: {
              url: coverUrl
            }
          }
        ]
      };
    }

    if (totalEpisodes !== null) {
      properties['Total Episodes'] = { number: totalEpisodes };
    }

    if (format) {
      properties['Format'] = { select: { name: format } };
    }

    if (targetRating) {
      properties['My Rating'] = { select: { name: targetRating } };
    }

    if (globalScore !== null) {
      properties['MAL Score'] = { number: globalScore };
    }

    if (studio) {
      properties['Studio'] = { select: { name: studio } };
    }

    if (genres && genres.length > 0) {
      properties['Genres'] = {
        multi_select: genres.map(g => ({ name: g }))
      };
    }

    if (synopsis) {
      const cleanSynopsis = synopsis.substring(0, 1900); // 2000 char rich-text limit
      properties['Synopsis'] = {
        rich_text: [
          {
            text: {
              content: cleanSynopsis
            }
          }
        ]
      };
    }

    // Set page cover image if coverUrl is available
    const pageData = {
      parent: { database_id: DATABASE_ID },
      properties: properties
    };

    if (coverUrl) {
      pageData.cover = {
        type: 'external',
        external: {
          url: coverUrl
        }
      };
    }

    try {
      await notion.pages.create(pageData);
      return { type: 'created', title };
    } catch (err) {
      console.error(`\x1b[31m  Failed to create page for "${title}":\x1b[0m`, err.message);
      return { type: 'error', title };
    }
  }
}

/**
 * Master Sync Process
 */
async function startSync() {
  console.log('====================================================');
  console.log('\x1b[35m🚀 Starting MyAnimeList -> Notion Watchlist Sync\x1b[0m');
  console.log('====================================================\n');

  const startTime = Date.now();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    // 1. Build cache of current Notion items
    const existingCache = await fetchNotionCache();

    // 2. Fetch data from MyAnimeList
    const malItems = await fetchMALList();

    if (malItems.length === 0) {
      console.log('\x1b[33mNo anime found on MyAnimeList to sync. Verify username or sync filter settings.\x1b[0m');
      return;
    }

    // 3. Loop through and sync each item to Notion
    console.log('\x1b[36mSyncing entries to Notion database...\x1b[0m');
    for (const item of malItems) {
      const result = await syncItemToNotion(item, existingCache);
      
      if (result.type === 'created') createdCount++;
      else if (result.type === 'updated') updatedCount++;
      else if (result.type === 'skipped') skippedCount++;
      else if (result.type === 'error' || result.type === 'failed') errorCount++;

      // Small delay between Notion API edits to guarantee rate limits compliance
      await sleep(350);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n====================================================');
    console.log('\x1b[32m🎉 Syncing complete!\x1b[0m');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`🟢 Created: ${createdCount}`);
    console.log(`🟡 Updated: ${updatedCount}`);
    console.log(`⚪ Skipped (No changes): ${skippedCount}`);
    console.log(`🔴 Errors: ${errorCount}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('\n\x1b[31mCritical error during execution:\x1b[0m', error);
  }
}

startSync();
