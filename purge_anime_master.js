/**
 * purge_anime_master.js
 * Scans the Notion Movies and TV Series databases for animated entries,
 * verifies their Japanese origin via TVMaze/OMDb keyless APIs,
 * and automatically archives (removes) them to isolate Japanese anime.
 * Fully optimized with Notion filters to process only "Animation" cards.
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MOVIE_DB_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const TV_DB_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not configured.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Cleans search queries for maximum matching accuracy
function cleanSearchTitle(title) {
  return title
    .replace(/\s*\([^)]*\)\s*$/, '') // Remove parentheses (e.g. (TV))
    .trim();
}

// 1. Verifies if a TV show is Japanese via TVMaze singlesearch
async function isTvShowJapaneseAnime(title) {
  const q = cleanSearchTitle(title);
  try {
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(q)}`;
    const response = await axios.get(url, { timeout: 5000 });
    if (response.data) {
      const lang = response.data.language || '';
      const netCountry = response.data.network?.country?.code || '';
      const webCountry = response.data.webChannel?.country?.code || '';
      
      const isJP = lang.toLowerCase() === 'japanese' || 
                   netCountry.toUpperCase() === 'JP' || 
                   webCountry.toUpperCase() === 'JP';
      return { isAnime: isJP, reason: `Lang: ${lang}, Country: ${netCountry || webCountry || 'Unknown'}` };
    }
  } catch (err) {
    // Fail silently, fallback to string checks
  }
  
  // Secondary fallback: title string checks
  const lower = title.toLowerCase();
  const hasAnimeIndicators = lower.includes('season') && (lower.includes('sub') || lower.includes('dub'));
  return { isAnime: hasAnimeIndicators, reason: 'Title indicator check' };
}

// 2. Verifies if a Movie is Japanese via OMDb
async function isMovieJapaneseAnime(title) {
  const q = cleanSearchTitle(title);
  try {
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(q)}&type=movie&apikey=thewdb`;
    const response = await axios.get(url, { timeout: 5000 });
    if (response.data && response.data.Response !== 'False') {
      const lang = response.data.Language || '';
      const country = response.data.Country || '';
      
      const isJP = lang.toLowerCase().includes('japanese') || 
                   country.toLowerCase().includes('japan');
      return { isAnime: isJP, reason: `Lang: ${lang}, Country: ${country}` };
    }
  } catch (err) {
    // Fail silently
  }
  return { isAnime: false, reason: 'OMDb query failed/not found' };
}

// Notion query with automatic retries for rate limits (429)
async function queryDatabaseWithRetry(queryPayload, retries = 5, delayMs = 3000) {
  try {
    return await notion.databases.query(queryPayload);
  } catch (error) {
    if ((error.status === 429 || error.message.includes('429') || error.message.toLowerCase().includes('rate')) && retries > 0) {
      console.warn(`\n⚠️  [Notion Rate Limit] Waiting ${delayMs}ms before retrying query (Retries left: ${retries})...`);
      await sleep(delayMs);
      return queryDatabaseWithRetry(queryPayload, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

// Process a single database
async function purgeAnime(dbId, isMovie = true) {
  const dbName = isMovie ? 'Movies' : 'TV Series';
  console.log(`\n====================================================`);
  console.log(`🧹 SCANNING ${dbName.toUpperCase()} FOR JAPANESE ANIME`);
  console.log(`====================================================`);

  let scannedCount = 0;
  let animeCount = 0;
  let hasMore = true;
  let startCursor = undefined;

  try {
    while (hasMore) {
      // Query ONLY pages containing the "Animation" genre tag to save API calls!
      const response = await queryDatabaseWithRetry({
        database_id: dbId,
        start_cursor: startCursor,
        page_size: 100,
        filter: {
          property: 'Genre',
          multi_select: {
            contains: 'Animation'
          }
        }
      });

      for (const page of response.results) {
        scannedCount++;
        
        let title = '';
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            title = prop.title[0].plain_text;
            break;
          }
        }

        if (!title) continue;

        console.log(`[#${scannedCount}] Auditing animated title: "${title}"...`);

        // Check origin metadata
        let checkResult = { isAnime: false, reason: '' };
        if (isMovie) {
          checkResult = await isMovieJapaneseAnime(title);
        } else {
          checkResult = await isTvShowJapaneseAnime(title);
        }

        if (checkResult.isAnime) {
          animeCount++;
          console.log(`  🚨 \x1b[31mAnime Detected!\x1b[0m (${checkResult.reason})`);
          console.log(`  🧹 Archiving card in Notion...`);
          
          try {
            // Archive page (marks archived = true, moving it out of active database views)
            await notion.pages.update({
              page_id: page.id,
              archived: true
            });
            console.log(`  -> \x1b[32m✔ Successfully archived!\x1b[0m`);
          } catch (err) {
            console.error(`  -> ❌ Archive failed:`, err.message);
          }
          
          // API throttle delay
          await sleep(350);
        } else {
          console.log(`  -> 🟢 Valid Western/Non-anime animation. Keeping.`);
        }
        
        // Minor sleep between checks
        await sleep(200);
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor;
      await sleep(350);
    }

    console.log(`\n🎉 ${dbName} anime purge sweep complete!`);
    console.log(`🟢 Total animated titles audited: ${scannedCount}`);
    console.log(`🔴 Japanese Anime cards removed: ${animeCount}`);

  } catch (err) {
    console.error(`Critical error sweeping ${dbName}:`, err.message);
  }
}

async function run() {
  console.log('====================================================');
  console.log('🧹 MASTER JAPANESE ANIME PURGE SWEEP');
  console.log('====================================================');

  // 1. Purge TV Series Database
  await purgeAnime(TV_DB_ID, false);

  // 2. Purge Movies Database
  await purgeAnime(MOVIE_DB_ID, true);

  console.log('\n====================================================');
  console.log('🎉 MASTER ANIME PURGES COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');
}

run();
