/**
 * purge_anime_perfect.js
 * 1. Restores the 5 Western animation false positives from the earlier run.
 * 2. Implements a refined origin check that protects outsourced/co-produced Western movies.
 * 3. Sweeps both TV Series and Movies databases to archive only genuine Japanese anime.
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

const FALSE_POSITIVES = [
  "An American Tail: The Treasure of Manhattan Island",
  "The Last Unicorn",
  "Rugrats In Paris",
  "The Tigger Movie",
  "The Emperor's New Groove"
];

// 1. Searches and restores false positives
async function restoreFalsePositives() {
  console.log('====================================================');
  console.log('🔄 RESTORING WESTERN ANIMATION FALSE POSITIVES');
  console.log('====================================================');

  for (const title of FALSE_POSITIVES) {
    console.log(`🔍 Searching for archived page: "${title}"...`);
    try {
      const searchRes = await notion.search({
        query: title,
        filter: {
          property: 'object',
          value: 'page'
        }
      });

      const pages = searchRes.results.filter(p => {
        // Double check it belongs to the Movies database and has the correct title
        if (p.parent?.database_id?.replace(/-/g, '') !== MOVIE_DB_ID.replace(/-/g, '')) return false;
        
        let pageTitle = '';
        for (const prop of Object.values(p.properties)) {
          if (prop.type === 'title' && prop.title?.length > 0) {
            pageTitle = prop.title[0].plain_text;
            break;
          }
        }
        return pageTitle.toLowerCase() === title.toLowerCase();
      });

      if (pages.length > 0) {
        for (const page of pages) {
          if (page.archived) {
            console.log(`  -> 🟢 Found archived page. Un-archiving...`);
            await notion.pages.update({
              page_id: page.id,
              archived: false
            });
            console.log(`  -> ✔ "${title}" restored successfully!`);
          } else {
            console.log(`  -> ⚪ Page is already active. Skipping.`);
          }
          await sleep(350);
        }
      } else {
        console.log(`  -> ⚠️  Could not find page in database. Skipping.`);
      }
    } catch (err) {
      console.error(`  -> ❌ Failed to restore "${title}":`, err.message);
    }
  }
}

// Cleans search queries for maximum matching accuracy
function cleanSearchTitle(title) {
  return title
    .replace(/\s*\([^)]*\)\s*$/, '') // Remove parentheses (e.g. (TV))
    .trim();
}

// 2. Verifies if a TV show is Japanese via TVMaze singlesearch
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
    // Fail silently
  }
  
  // Secondary fallback: title string checks
  const lower = title.toLowerCase();
  const hasAnimeIndicators = lower.includes('season') && (lower.includes('sub') || lower.includes('dub'));
  return { isAnime: hasAnimeIndicators, reason: 'Title indicator check' };
}

// 3. Refined origin check for Movies (verifies Japanese-first production)
async function isMovieJapaneseAnime(title) {
  const q = cleanSearchTitle(title);
  try {
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(q)}&type=movie&apikey=thewdb`;
    const response = await axios.get(url, { timeout: 5000 });
    if (response.data && response.data.Response !== 'False') {
      const lang = response.data.Language || '';
      const country = response.data.Country || '';
      
      const countryList = country.split(',').map(c => c.trim().toLowerCase());
      const langList = lang.split(',').map(l => l.trim().toLowerCase());
      
      // Strict rule: It's anime if:
      // - First language is Japanese, OR
      // - First country is Japan AND it does not contain USA/UK co-production (unless Japanese is first language).
      const isJapanFirst = countryList[0] === 'japan' && 
                           (langList[0] === 'japanese' || (!countryList.includes('united states') && !countryList.includes('usa') && !countryList.includes('united kingdom') && !countryList.includes('uk')));
      const isJapaneseLangFirst = langList[0] === 'japanese';
      
      const isJP = isJapanFirst || isJapaneseLangFirst;
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
  let batchNum = 0;

  try {
    while (hasMore) {
      batchNum++;
      console.log(`📡 Querying ${dbName} animated batch #${batchNum}...`);
      
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
  // 1. First restore false positives
  await restoreFalsePositives();

  console.log('\n====================================================');
  console.log('🧹 STARTING REFINED JAPANESE ANIME PURGE SWEEP');
  console.log('====================================================');

  // 2. Purge TV Series Database
  await purgeAnime(TV_DB_ID, false);

  // 3. Purge Movies Database
  await purgeAnime(MOVIE_DB_ID, true);

  console.log('\n====================================================');
  console.log('🎉 MASTER ANIME PURGES COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');
}

run();
