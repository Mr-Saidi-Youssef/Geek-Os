/**
 * repair_tv_genres.js
 * Scans the Notion TV Series database to repair and enrich empty and collapsed genres.
 * Bypasses the initial collapsing mapping and restores standard genres (e.g. War, History, Western, Biography, Reality, Documentary, Mystery).
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const scanLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10000;

// Helper: Strip HTML tags
function stripHtml(htmlString) {
  if (!htmlString) return '';
  return htmlString.replace(/<[^>]*>/g, '');
}

// Cleans search queries for maximum TVMaze singlesearch accuracy
function cleanSearchTitle(title) {
  return title
    .replace(/^British\s+/i, '')
    .replace(/^American\s+/i, '')
    .replace(/^Stephen King's\s+/i, '')
    .replace(/\(UK\)$/i, '')
    .replace(/\(US\)$/i, '')
    .trim();
}

// Normalizes genre names
function normalizeGenreName(name) {
  if (!name) return '';
  const clean = name.trim();
  if (clean.toLowerCase() === 'science-fiction' || clean.toLowerCase() === 'science fiction' || clean.toLowerCase() === 'sci-fi') {
    return 'Sci-Fi';
  }
  return clean.replace(/\b\w/g, c => c.toUpperCase());
}

// Notion page updates with retry mechanics for rate limits
async function updatePageWithRetry(pageId, pageParams, retries = 5, delayMs = 3000) {
  try {
    return await notion.pages.update({ page_id: pageId, ...pageParams });
  } catch (error) {
    if ((error.status === 429 || error.message.includes('429') || error.message.toLowerCase().includes('rate')) && retries > 0) {
      console.warn(`  [Notion Rate Limit] Waiting ${delayMs}ms before retrying page update (Retries left: ${retries})...`);
      await sleep(delayMs);
      return updatePageWithRetry(pageId, pageParams, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

// TVMaze rich metadata search (returns raw genres list)
async function queryTvMazeGenres(title) {
  const queryAttempts = [
    title,
    title.replace(/^(The)\s+/i, '').trim(),
    cleanSearchTitle(title),
    title.split(':')[0].trim(),
    title.split('/')[0].trim()
  ];
  
  const uniqueQueries = [...new Set(queryAttempts.map(q => q.trim()).filter(Boolean))];
  
  for (const q of uniqueQueries) {
    if (!q) continue;
    
    // 1. Try singlesearch first
    try {
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(q)}`;
      const response = await axios.get(url, { timeout: 4000 });
      if (response.data && response.data.genres && response.data.genres.length > 0) {
        return response.data.genres;
      }
    } catch (err) {
      // Continue
    }

    // 2. Try search list fallback
    try {
      const fallbackUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
      const resFallback = await axios.get(fallbackUrl, { timeout: 4000 });
      if (resFallback.data && resFallback.data.length > 0) {
        const bestMatch = resFallback.data.find(d => d.show && d.show.genres && d.show.genres.length > 0);
        if (bestMatch) {
          return bestMatch.show.genres;
        }
      }
    } catch (e) {
      // Continue
    }
  }
  return [];
}

async function run() {
  console.log('====================================================');
  console.log(`🚀 TV SERIES GENRES RESTORATION & REPAIR SWEEP ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);
  console.log(`   Restoring War, History, Western, Biography, Reality, etc.`);
  console.log('====================================================\n');

  try {
    console.log('Querying Notion TV database...');
    let checkedCount = 0;
    let updatedCount = 0;
    let emptyCount = 0;
    let mismatchedCount = 0;

    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        if (checkedCount >= scanLimit) {
          hasMore = false;
          break;
        }

        checkedCount++;
        let title = '';
        
        // Extract title
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            title = prop.title[0].plain_text;
            break;
          }
        }

        if (!title) continue;
        const cleanTitle = title.trim();
        
        // Get current genres
        const currentGenreProp = page.properties['Genre'];
        const currentGenres = currentGenreProp && currentGenreProp.multi_select 
          ? currentGenreProp.multi_select.map(g => g.name) 
          : [];

        // Determine true genres from TVMaze
        let rawTrueGenres = await queryTvMazeGenres(cleanTitle);
        let trueGenres = rawTrueGenres.map(g => normalizeGenreName(g)).filter(Boolean);

        if (trueGenres.length === 0) {
          // No genres found on TVMaze
          continue;
        }

        // Compare current genres with true genres
        const currentSet = new Set(currentGenres);
        const trueSet = new Set(trueGenres);

        let needsUpdate = false;
        let updateReason = '';

        if (currentGenres.length === 0) {
          needsUpdate = true;
          updateReason = 'Empty Genres';
          emptyCount++;
        } else {
          const missing = trueGenres.filter(g => !currentSet.has(g));
          if (missing.length > 0) {
            needsUpdate = true;
            updateReason = `Missing genres: ${missing.join(', ')}`;
            mismatchedCount++;
          }
        }

        if (needsUpdate) {
          console.log(`[Update Identified] "${cleanTitle}" (${updateReason})`);
          console.log(`  Current Genres: [${currentGenres.join(', ')}]`);
          console.log(`  True Genres:    [${trueGenres.join(', ')}]`);

          if (!dryRun) {
            try {
              await updatePageWithRetry(page.id, {
                properties: {
                  'Genre': {
                    multi_select: trueGenres.map(g => ({ name: g }))
                  }
                }
              });
              updatedCount++;
              console.log(`  \x1b[32m✔ Successfully updated TV genres in Notion.\x1b[0m`);
            } catch (err) {
              console.error(`  \x1b[31m✘ Failed to update genres: ${err.message}\x1b[0m`);
            }
            await sleep(350); // respect Notion write rate
          } else {
            console.log(`  \x1b[33m[Dry Run] Would update TV genres to: [${trueGenres.join(', ')}]\x1b[0m`);
          }
        }
      }

      if (!hasMore) break;
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log('\n====================================================');
    console.log(`🎉 TV GENRES SWEEP COMPLETE!`);
    console.log(`🟢 Total series scanned: ${checkedCount}`);
    console.log(`🟢 Total empty genre cards identified: ${emptyCount}`);
    console.log(`🟢 Total mismatched/collapsed cards identified: ${mismatchedCount}`);
    console.log(`🟢 Total TV cards updated: ${updatedCount}`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Critical error in TV Genres repair sweep:', err.message);
  }
}

run();
