/**
 * Keyless IMDb Top 1000 TV Series to Notion Importer
 * Powered by public GitHub IMDB CSV Dataset, TVMaze API, & Official Notion Client
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_TV_DATABASE_ID;

const CSV_URL = 'https://raw.githubusercontent.com/ankoorb/IMDB/master/tv_shows.csv';

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

// Parses python-formatted string list of genres, e.g. "[u'Adventure', u'Drama']"
function parseCsvGenres(genreString) {
  if (!genreString) return [];
  const cleaned = genreString.replace(/[\[\]u']/g, '');
  return cleaned.split(',').map(g => g.trim()).filter(Boolean);
}

// Maps genres to Notion multi-select options
function mapGenres(genresArray) {
  const allowed = new Set(['Action & Adventure', 'Sci-Fi', 'Drama', 'Thriller', 'Romance', 'Comedy', 'Animation', 'Horror', 'Crime', 'Fantasy']);
  const mapped = [];

  for (const name of genresArray) {
    if (allowed.has(name)) {
      mapped.push(name);
    } else if (name === 'Science Fiction' || name === 'Sci-Fi' || name === 'Science-Fiction') {
      mapped.push('Sci-Fi');
    } else if (name === 'Action' || name === 'Adventure' || name === 'War') {
      mapped.push('Action & Adventure');
    } else if (name === 'Mystery' || name === 'Suspense') {
      mapped.push('Thriller');
    } else if (name === 'Family' || name === 'Supernatural') {
      mapped.push('Fantasy');
    } else if (name === 'Biography' || name === 'History' || name === 'Western' || name === 'Medical' || name === 'Legal') {
      mapped.push('Drama');
    }
  }
  return [...new Set(mapped)];
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
      let val = values[idx] || '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      obj[h.trim()] = unescapeHtml(val); // Auto-unescape all parsed values!
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
    console.log(`\x1b[32mCache built successfully! Loaded ${cache.size} existing series titles from Notion.\x1b[0m\n`);
    return cache;
  } catch (error) {
    console.error('\x1b[31mError querying Notion database:\x1b[0m', error.message);
    throw error;
  }
}

// Clear Notion database by archiving all existing pages (Start all over)
async function clearDatabase() {
  console.log('\x1b[31;1mClearing all existing series from Notion (Start All Over)...\x1b[0m');
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
    console.log(`\x1b[32mSuccessfully cleared ${archivedCount} existing series from database!\x1b[0m\n`);
  } catch (error) {
    console.error('\x1b[31mError clearing database:\x1b[0m', error.message);
  }
}

// Scrapes first YouTube video URL for a TV series trailer keylessly
async function getYoutubeTrailer(title, releaseYear) {
  try {
    const query = encodeURIComponent(`${title} ${releaseYear} official trailer tv series`);
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
    // Fail silently
  }
  return '';
}

// Cleans search queries for maximum TVMaze search accuracy
function cleanSearchTitle(title) {
  return title
    .replace(/^British\s+/i, '')
    .replace(/^American\s+/i, '')
    .replace(/^Stephen King's\s+/i, '')
    .replace(/^The Being\s+/i, '') // e.g. "The Being Frank Show" -> "Frank Show"
    .replace(/\(UK\)$/i, '')
    .replace(/\(US\)$/i, '')
    .replace(/Black-Adder/i, 'Blackadder')
    .replace(/Black Adder/i, 'Blackadder')
    .replace(/Erufen r\u00EEto/i, 'Elfen Lied')
    .replace(/Poketto Monsut\u00E2/i, 'Pokemon')
    .replace(/Isler G\u00FC\u00E7ler/i, 'Isler Gucler')
    .replace(/Yugio deyueru monsutazu/i, 'Yu-Gi-Oh')
    .replace(/Carniv\u00E0le/i, 'Carnivale')
    .replace(/Behzat \u00C7\./i, 'Behzat C')
    .replace(/Mighty Morphin Power Rangers/i, 'Power Rangers')
    .trim();
}

// Fetches poster cover and network platform from TVMaze search keylessly with fallbacks
async function getTvMazeMetadata(title) {
  // Try multiple fallback variations in order of specificity
  const queryAttempts = [
    title,
    title.replace(/^(The)\s+/i, '').trim(), // e.g. "The Nostalgia Critic" -> "Nostalgia Critic"
    cleanSearchTitle(title),
    title.split(':')[0].trim(), // e.g. "Rurouni Kenshin: Wandering Samurai" -> "Rurouni Kenshin"
    title.split('/')[0].trim(), // e.g. "The Bugs Bunny/Looney Tunes Comedy Hour" -> "The Bugs Bunny"
    title.split(/\s+with\s+/i)[0].trim(), // e.g. "Mr. Show with Bob and David" -> "Mr. Show"
    title.split(/\s+Starring\s+/i)[0].trim(), // e.g. "The Tonight Show Starring Jimmy Fallon" -> "The Tonight Show"
    title.replace(/\s+[IVX]+$/i, '').trim(), // e.g. "Hellsing X" -> "Hellsing"
    title.replace(/\s+the\s+[a-z]+/i, '').trim(), // e.g. "Black Adder the Third" -> "Black Adder"
    title.replace(/\s+Goes\s+Forth/i, '').trim() // e.g. "Blackadder Goes Forth" -> "Blackadder"
  ];
  
  // Clean duplicates and empty queries
  const uniqueQueries = [...new Set(queryAttempts.map(q => q.trim()).filter(Boolean))];
  
  for (const q of uniqueQueries) {
    if (!q) continue;
    
    // 1. Try singlesearch first
    try {
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(q)}`;
      const response = await axios.get(url);
      if (response.data) {
        const largeCover = response.data.image ? (response.data.image.original || response.data.image.medium) : '';
        const network = response.data.network ? response.data.network.name : (response.data.webChannel ? response.data.webChannel.name : '');
        const genres = response.data.genres || [];
        if (largeCover) {
          return { largeCover, network, genres };
        }
      }
    } catch (err) {
      // Singlesearch failed or returned 404, fall through to list search
    }

    // 2. Try list search fallback (handles shows with null cover on the first result like Baywatch)
    try {
      const fallbackUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
      const resFallback = await axios.get(fallbackUrl);
      if (resFallback.data && resFallback.data.length > 0) {
        // Find the first result that actually has a cover poster!
        const matchingShow = resFallback.data.find(d => d.show && d.show.image);
        if (matchingShow) {
          const show = matchingShow.show;
          const largeCover = show.image.original || show.image.medium || '';
          const network = show.network ? show.network.name : (show.webChannel ? show.webChannel.name : '');
          const genres = show.genres || [];
          if (largeCover) {
            return { largeCover, network, genres };
          }
        }
      }
    } catch (e) {
      // List search fallback failed, try next query variation
    }
  }
  return { largeCover: '', network: '', genres: [] };
}

// Map a CSV record and resolved trailer/metadata to Notion API properties
function buildNotionProperties(record, metadata, trailerUrl) {
  const title = record.title || 'Unknown Title';
  
  // Parse year (e.g. "(2011 TV Series)" or "(2008-2013)")
  const rawYear = record.year || '';
  const yearMatch = rawYear.match(/\d{4}/);
  const releaseYear = yearMatch ? parseInt(yearMatch[0], 10) : null;

  // Parse runtime (e.g. "55 mins." -> 55)
  const rawRuntime = record.runtime || '';
  const runtime = parseInt(rawRuntime.replace(/\D/g, ''), 10) || null;

  // Parse IMDb Rating
  const imdbRating = parseFloat(record.rating) || null;
  const synopsis = record.text || '';

  // Combine CSV genres and TVMaze genres
  const csvGenres = parseCsvGenres(record.genre);
  const allGenres = [...new Set([...csvGenres, ...metadata.genres])];
  const genres = mapGenres(allGenres);

  const properties = {
    'Title': {
      title: [{ text: { content: title } }]
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

  if (metadata.network) {
    properties['Platform'] = {
      multi_select: [{ name: metadata.network }]
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
  console.log('\x1b[35m🎬 Keyless Top 1000 TV Series Importer + Posters + Trailers\x1b[0m');
  console.log('====================================================');
  if (isDryRun) {
    console.log('\x1b[33m*** DRY RUN MODE (No API calls will be made to Notion) ***\x1b[0m\n');
  } else {
    // Enforce database check only in live run
    if (!DATABASE_ID || DATABASE_ID.includes('your_tv_database_id_here')) {
      console.log('\x1b[33m====================================================\x1b[0m');
      console.log('\x1b[31m⚠️  NOTION_TV_DATABASE_ID is not configured in your .env file!\x1b[0m');
      console.log('\x1b[36mTo set it up:\x1b[0m');
      console.log('1. Open your Notion workspace.');
      console.log('2. Create a new database named "TV Series Library" (or duplicate your Movie database).');
      console.log('3. Open the new database as a full page, copy its ID from the URL.');
      console.log('4. Click "..." at the top right of the page, go to "Connect to" / "Connecter à", and select "MAL Anime Watchlist Sync".');
      console.log('5. Open your local ".env" file and add the following line:');
      console.log('   NOTION_TV_DATABASE_ID=your_new_database_id_here');
      console.log('\x1b[33m====================================================\x1b[0m\n');
      process.exit(1);
    }
  }

  try {
    // 1. Download and Parse CSV
    console.log(`Downloading TV Series dataset from: ${CSV_URL}...`);
    const res = await axios.get(CSV_URL);
    const shows = parseCSV(res.data);
    console.log(`\x1b[32mSuccessfully downloaded and parsed ${shows.length} TV Shows!\x1b[0m\n`);

    if (shows.length === 0) {
      console.error('\x1b[31mError: TV Series dataset is empty or failed to parse.\x1b[0m');
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
    
    // Take the top 1000 sorted shows
    const totalShows = Math.min(shows.length, 1000);

    console.log(`Syncing Top ${totalShows} TV Series with YouTube trailers & TVMaze covers to Notion...`);

    for (let i = 0; i < totalShows; i++) {
      const record = shows[i];
      const title = record.title;
      if (!title) continue;

      // Extract release year for trailer search
      const rawYear = record.year || '';
      const yearMatch = rawYear.match(/\d{4}/);
      const releaseYear = yearMatch ? yearMatch[0] : '';

      const cacheKey = title.toLowerCase().trim();
      const existingPageId = existingCache.get(cacheKey);

      if (isDryRun) {
        const csvGenres = parseCsvGenres(record.genre);
        const genres = mapGenres(csvGenres);
        const runtime = parseInt((record.runtime || '').replace(/\D/g, ''), 10) || 0;
        console.log(`\x1b[36m[Dry-Run] Title: "${title}" (${releaseYear})\x1b[0m`);
        console.log(`  Runtime: ${runtime}m | IMDb Rating: ${record.rating}`);
        console.log(`  Genres: [${genres.join(', ')}]`);
        console.log(`  Synopsis: "${(record.text || '').substring(0, 100)}..."`);
        console.log('----------------------------------------------------');
        continue;
      }

      // Fetch dynamic cover and network platform from TVMaze keylessly
      console.log(`\x1b[35m[TVMaze Lookup] Fetching poster & platform for "${title}"...\x1b[0m`);
      const metadata = await getTvMazeMetadata(title);
      if (metadata.largeCover) {
        console.log(`  Cover poster found: ${metadata.largeCover}`);
      } else {
        console.log(`\x1b[31m  ⚠️ No cover poster found for "${title}"\x1b[0m`);
      }
      if (metadata.network) {
        console.log(`  Network platform found: ${metadata.network}`);
      }

      // Live search YouTube trailer link keylessly
      console.log(`\x1b[34m[YouTube Search] Searching trailer for "${title}" (${releaseYear})...\x1b[0m`);
      const trailerUrl = await getYoutubeTrailer(title, releaseYear);
      if (trailerUrl) {
        console.log(`  Found Trailer: ${trailerUrl}`);
      } else {
        console.log(`  No trailer resolved.`);
      }

      const properties = buildNotionProperties(record, metadata, trailerUrl);
      const highResPoster = metadata.largeCover;

      try {
        if (existingPageId) {
          // Update properties and cover if exists
          console.log(`\x1b[33m[Updating] (${i + 1}/${totalShows}) "${title}" (${releaseYear}) in Notion...\x1b[0m`);
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
          console.log(`\x1b[32m[Inserting] (${i + 1}/${totalShows}) "${title}" (IMDb: ${record.rating}) into Notion...\x1b[0m`);
          const pageData = {
            parent: { database_id: DATABASE_ID },
            properties: properties
          };

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
    console.log('\x1b[32m🎉 IMDb Top TV Series Sync Finished!\x1b[0m');
    if (isDryRun) {
      console.log(`🟢 Dry-run validated ${totalShows} TV Series mappings.`);
    } else {
      console.log(`🟢 Successfully Created: ${insertedCount} new series pages.`);
      console.log(`🟡 Successfully Updated: ${updatedCount} existing series pages.`);
      console.log(`⚪ Skipped: ${skippedCount} pages.`);
    }
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in TV Series Importer:', error.message);
  }
}

start();
