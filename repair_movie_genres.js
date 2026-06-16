/**
 * repair_movie_genres.js
 * Scans the Notion Movie Library database to repair and enrich empty and collapsed genres.
 * Bypasses the initial collapsing mapping and restores standard genres (e.g. War, History, Western, Biography, Music, Documentary, Family, Mystery).
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const CSV_URL = 'https://raw.githubusercontent.com/Irene-arch/TMDB-Movies-Dataset/master/tmdb-movies.csv';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const scanLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10000;

// Decodes HTML entities
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#([0-9]+);/gi, (match, numStr) => String.fromCharCode(parseInt(numStr, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (match, hexStr) => String.fromCharCode(parseInt(hexStr, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Parses a CSV line respecting quotes
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; 
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(csvContent) {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < headers.length) continue;

    const obj = {};
    headers.forEach((h, idx) => {
      let val = values[idx] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      obj[h.trim()] = decodeHtmlEntities(val);
    });
    records.push(obj);
  }
  return records;
}

// Normalizes genre names from raw sources to standard titles
function normalizeGenreName(name) {
  if (!name) return '';
  const clean = name.trim();
  if (clean.toLowerCase() === 'science fiction' || clean.toLowerCase() === 'sci-fi') {
    return 'Sci-Fi';
  }
  if (clean.toLowerCase() === 'film-noir') {
    return 'Film-Noir';
  }
  // Capitalize first letter of each word
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

// Keyless OMDb title query
async function queryOmdbGenres(title) {
  try {
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=thewdb`;
    const res = await axios.get(url, { timeout: 4000 });
    if (res.data && res.data.Response === 'True' && res.data.Genre && res.data.Genre !== 'N/A') {
      return res.data.Genre.split(',').map(g => g.trim()).filter(Boolean);
    }
  } catch (err) {
    // Ignore and return empty
  }
  return [];
}

async function run() {
  console.log('====================================================');
  console.log(`🚀 MOVIE GENRES RESTORATION & REPAIR SWEEP ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);
  console.log(`   Restoring War, History, Western, Biography, Music, etc.`);
  console.log('====================================================\n');

  try {
    // 1. Fetch and Parse CSV
    console.log(`Downloading movies CSV from: ${CSV_URL}...`);
    const csvResponse = await axios.get(CSV_URL);
    const csvMovies = parseCSV(csvResponse.data);
    console.log(`Loaded ${csvMovies.length} movies from CSV dataset.`);

    // Map CSV: lowercased title -> raw genres array
    const csvMap = new Map();
    for (const m of csvMovies) {
      if (m.original_title && m.genres) {
        const titleKey = m.original_title.toLowerCase().trim();
        const genresList = m.genres.split('|').map(g => normalizeGenreName(g)).filter(Boolean);
        // If title already exists, merge genres
        if (csvMap.has(titleKey)) {
          csvMap.set(titleKey, [...new Set([...csvMap.get(titleKey), ...genresList])]);
        } else {
          csvMap.set(titleKey, genresList);
        }
      }
    }
    console.log(`Mapped ${csvMap.size} unique titles from CSV.\n`);

    // 2. Query Movies Database
    console.log('Querying Notion database...');
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

        // Determine true genres
        let trueGenres = [];
        const titleKey = cleanTitle.toLowerCase();
        
        if (csvMap.has(titleKey)) {
          trueGenres = csvMap.get(titleKey);
        } else {
          // Fallback to OMDb API
          trueGenres = await queryOmdbGenres(cleanTitle);
          if (trueGenres.length > 0) {
            trueGenres = trueGenres.map(g => normalizeGenreName(g));
          }
        }

        if (trueGenres.length === 0) {
          // No genres found in both sources
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
          // Check if any true genre is missing from current genres, 
          // OR if there is a mismatch (e.g. collapsed action/war/history)
          const missing = trueGenres.filter(g => !currentSet.has(g));
          
          // Also detect if the movie has "Action & Adventure" in current, but "Action" or "Adventure" in true
          // and see if we should restore it to true genres
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
              console.log(`  \x1b[32m✔ Successfully updated genres in Notion.\x1b[0m`);
            } catch (err) {
              console.error(`  \x1b[31m✘ Failed to update genres: ${err.message}\x1b[0m`);
            }
            await sleep(350); // Notion rate limit safety throttle
          } else {
            console.log(`  \x1b[33m[Dry Run] Would update genres to: [${trueGenres.join(', ')}]\x1b[0m`);
          }
        }
      }

      if (!hasMore) break;
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log('\n====================================================');
    console.log(`🎉 GENRES SWEEP COMPLETE!`);
    console.log(`🟢 Total movies scanned: ${checkedCount}`);
    console.log(`🟢 Total empty genre cards identified: ${emptyCount}`);
    console.log(`🟢 Total mismatched/collapsed cards identified: ${mismatchedCount}`);
    console.log(`🟢 Total movie cards updated: ${updatedCount}`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Critical error in Genres seeder sweep:', err.message);
  }
}

run();
