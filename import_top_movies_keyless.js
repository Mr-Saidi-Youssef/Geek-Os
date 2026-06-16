/**
 * Keyless IMDb Top 1000 to Notion Importer
 * Powered by public GitHub CSV Dataset & Official Notion Client
 * Developed for Byronotion Movies Collection
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';

const CSV_URL = 'https://raw.githubusercontent.com/krishna-koly/IMDB_TOP_1000/main/imdb_top_1000.csv';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

// Initialize Notion Client
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Unescapes HTML entity characters commonly found in scraped datasets (supports decimal, hex, and named entities)
function unescapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&#([0-9]+);/gi, (match, numStr) => {
      const num = parseInt(numStr, 10);
      return String.fromCharCode(num);
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, hexStr) => {
      const num = parseInt(hexStr, 16);
      return String.fromCharCode(num);
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Maps CSV Genres to Notion schema multi-select options
function mapGenres(genreString) {
  if (!genreString) return [];
  const rawGenres = genreString.split(',').map(g => g.trim());
  const allowed = new Set(['Action & Adventure', 'Sci-Fi', 'Drama', 'Thriller', 'Romance', 'Comedy', 'Animation', 'Horror', 'Crime', 'Fantasy']);
  const mapped = [];

  for (const name of rawGenres) {
    if (allowed.has(name)) {
      mapped.push(name);
    } else if (name === 'Science Fiction' || name === 'Sci-Fi') {
      mapped.push('Sci-Fi');
    } else if (name === 'Action' || name === 'Adventure') {
      mapped.push('Action & Adventure');
    } else if (name === 'Mystery') {
      mapped.push('Thriller');
    } else if (name === 'War') {
      mapped.push('Action & Adventure');
    } else if (name === 'Family') {
      mapped.push('Fantasy');
    } else if (name === 'Film-Noir' || name === 'Biography' || name === 'History' || name === 'Western') {
      mapped.push('Drama'); // Fallbacks to preserve variety
    }
  }
  return [...new Set(mapped)];
}

// Converts low-resolution Amazon thumbnails to high-resolution original covers
function getHighResPoster(url) {
  if (!url) return '';
  if (url.includes('m.media-amazon.com/images/')) {
    // Strip IMDb/Amazon thumbnail resizing suffix to get original full-res cover
    return url.replace(/@\._V1_.*\.jpg$/, '@.jpg');
  }
  return url;
}

// Scrapes first YouTube video URL for a movie search query keylessly
async function getYoutubeTrailer(movieTitle, releaseYear) {
  try {
    const query = encodeURIComponent(`${movieTitle} ${releaseYear} official trailer`);
    const searchUrl = `https://www.youtube.com/results?search_query=${query}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  } catch (err) {
    // Fail silently and return empty string if request or parsing fails
  }
  return '';
}

// Custom robust CSV line splitter that respects double quotes
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

// Parse CSV content into an array of objects
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
      // Clean leading/trailing quotes from the values
      let val = values[idx] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      obj[h.trim()] = unescapeHtml(val);
    });
    records.push(obj);
  }
  return records;
}

// Query Notion database to build cache of existing items
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
        let titleVal = '';
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            titleVal = prop.title[0].plain_text;
            break;
          }
        }
        if (titleVal) {
          cache.set(titleVal.toLowerCase().trim(), page.id);
        }
      }
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
    console.log(`\x1b[32mCache built successfully! Loaded ${cache.size} existing movie titles from Notion.\x1b[0m\n`);
    return cache;
  } catch (error) {
    console.error('\x1b[31mError querying Notion database:\x1b[0m', error.message);
    throw error;
  }
}

// Clear Notion database by archiving all existing pages (Start all over)
async function clearDatabase() {
  console.log('\x1b[31;1mClearing all existing movies from Notion (Start All Over)...\x1b[0m');
  let hasMore = true;
  let startCursor = undefined;
  let archivedCount = 0;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        let titleVal = 'Unknown';
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            titleVal = prop.title[0].plain_text;
            break;
          }
        }
        console.log(`\x1b[31m  [Archiving] "${titleVal}"...\x1b[0m`);
        try {
          await notion.pages.update({
            page_id: page.id,
            archived: true,
          });
          archivedCount++;
        } catch (e) {
          console.error(`  Failed to archive "${titleVal}":`, e.message);
        }
        await sleep(150); // safe limit delay
      }
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
    console.log(`\x1b[32mSuccessfully cleared ${archivedCount} existing movies from database!\x1b[0m\n`);
  } catch (error) {
    console.error('\x1b[31mError clearing database:\x1b[0m', error.message);
  }
}

// Map a CSV record and resolved trailer to Notion API properties
function buildNotionProperties(record, trailerUrl) {
  const title = record.Series_Title || 'Unknown Title';
  const director = record.Director || 'Unknown';
  
  // Safe parsing
  const releaseYear = parseInt(record.Released_Year, 10) || null;
  const runtime = parseInt((record.Runtime || '').replace(/\D/g, ''), 10) || null;
  const imdbRating = parseFloat(record.IMDB_Rating) || null;
  const synopsis = record.Overview || '';
  const genres = mapGenres(record.Genre);

  const properties = {
    'Title': {
      title: [{ text: { content: title } }]
    },
    'Director': {
      rich_text: [{ text: { content: director } }]
    },
    'Status': {
      select: { name: '🍿 To Watch' }
    },
    'Synopsis': {
      rich_text: [{ text: { content: synopsis.substring(0, 1900) } }]
    }
  };

  if (releaseYear !== null) {
    properties['ReleaseYear'] = { number: releaseYear };
  }

  if (runtime !== null) {
    properties['Runtime'] = { number: runtime };
  }

  if (imdbRating !== null) {
    properties['IMDbRating'] = { number: imdbRating };
  }

  if (genres.length > 0) {
    properties['Genre'] = {
      multi_select: genres.map(g => ({ name: g }))
    };
  }

  if (trailerUrl) {
    properties['Trailer'] = {
      url: trailerUrl
    };
  }

  return properties;
}

// Master execution flow
async function start() {
  const isDryRun = process.argv.includes('--dry-run');
  const shouldClear = !process.argv.includes('--no-clear') && !isDryRun;

  console.log('====================================================');
  console.log('\x1b[35m🎬 Keyless IMDb Top 1000 Movies Importer + Trailers\x1b[0m');
  console.log('====================================================');
  if (isDryRun) {
    console.log('\x1b[33m*** DRY RUN MODE (No API calls will be made to Notion) ***\x1b[0m\n');
  }

  try {
    // 1. Download and Parse CSV
    console.log(`Downloading movie dataset from: ${CSV_URL}...`);
    const res = await axios.get(CSV_URL);
    const movies = parseCSV(res.data);
    console.log(`\x1b[32mSuccessfully downloaded and parsed ${movies.length} movies!\x1b[0m\n`);

    if (movies.length === 0) {
      console.error('\x1b[31mError: Movie dataset is empty or failed to parse.\x1b[0m');
      return;
    }

    // 2. Clear Database (Start all over) if requested
    if (shouldClear) {
      await clearDatabase();
    }

    // 3. Build Notion Cache
    let existingCache = new Map();
    if (!isDryRun) {
      existingCache = await fetchNotionCache();
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const totalMovies = movies.length;

    console.log(`Syncing ${totalMovies} movies with YouTube trailers to Notion...`);

    for (let i = 0; i < totalMovies; i++) {
      const record = movies[i];
      const title = record.Series_Title;
      if (!title) continue;

      const cacheKey = title.toLowerCase().trim();
      const existingPageId = existingCache.get(cacheKey);

      if (isDryRun) {
        const genres = mapGenres(record.Genre);
        const runtime = parseInt((record.Runtime || '').replace(/\D/g, ''), 10) || 0;
        console.log(`\x1b[36m[Dry-Run] Title: "${title}" (${record.Released_Year})\x1b[0m`);
        console.log(`  Director: ${record.Director} | Runtime: ${runtime}m | IMDb Rating: ${record.IMDB_Rating}`);
        console.log(`  Genres: [${genres.join(', ')}]`);
        console.log(`  Synopsis: "${(record.Overview || '').substring(0, 100)}..."`);
        console.log('----------------------------------------------------');
        continue;
      }

      // Live search YouTube trailer link
      console.log(`\x1b[34m[YouTube Search] Searching trailer for "${title}" (${record.Released_Year})...\x1b[0m`);
      const trailerUrl = await getYoutubeTrailer(title, record.Released_Year);
      if (trailerUrl) {
        console.log(`  Found Trailer: ${trailerUrl}`);
      } else {
        console.log(`  No trailer resolved.`);
      }

      const properties = buildNotionProperties(record, trailerUrl);
      const posterLink = record.Poster_Link;
      const highResPoster = getHighResPoster(posterLink);

      try {
        if (existingPageId) {
          // Update properties and cover if exists
          console.log(`\x1b[33m[Updating] (${i + 1}/${totalMovies}) "${title}" (${record.Released_Year}) in Notion...\x1b[0m`);
          const updateData = {
            page_id: existingPageId,
            properties: properties
          };

          if (highResPoster && highResPoster.startsWith('http')) {
            updateData.cover = {
              type: 'external',
              external: { url: highResPoster }
            };
          }

          await notion.pages.update(updateData);
          updatedCount++;
        } else {
          // Create new page
          console.log(`\x1b[32m[Inserting] (${i + 1}/${totalMovies}) "${title}" (IMDb: ${record.IMDB_Rating}) into Notion...\x1b[0m`);
          const pageData = {
            parent: { database_id: DATABASE_ID },
            properties: properties
          };

          // Append high-res native page cover if poster exists
          if (highResPoster && highResPoster.startsWith('http')) {
            pageData.cover = {
              type: 'external',
              external: { url: highResPoster }
            };
          }

          await notion.pages.create(pageData);
          insertedCount++;
        }

        // Notion API rate-limiting sleep (350ms) to guarantee compliance
        await sleep(350);
      } catch (err) {
        console.error(`\x1b[31m  Failed to sync "${title}" to Notion:\x1b[0m`, err.message);
      }
    }

    console.log('\n====================================================');
    console.log('\x1b[32m🎉 IMDb Top 1000 Movies Sync Finished!\x1b[0m');
    if (isDryRun) {
      console.log(`🟢 Dry-run validated ${totalMovies} movie mappings.`);
    } else {
      console.log(`🟢 Successfully Created: ${insertedCount} new movie pages.`);
      console.log(`🟡 Successfully Updated: ${updatedCount} existing movie pages.`);
      console.log(`⚪ Skipped: ${skippedCount} pages.`);
    }
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in Top 1000 Movies Importer:', error.message);
  }
}

start();
