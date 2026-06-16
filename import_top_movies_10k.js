/**
 * Seeder for Movie Library - 10,000 Entries Scale-up
 * Powered by TMDB API OR Irene-arch 10k CSV + Keyless OMDb & TVMaze APIs
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const CSV_URL = 'https://raw.githubusercontent.com/Irene-arch/TMDB-Movies-Dataset/master/tmdb-movies.csv';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

// Initialize Notion Client
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Decodes HTML entities robustly
function decodeHtmlEntities(str) {
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

// Converts low-resolution Amazon thumbnails to high-resolution original covers
function getHighResPoster(url) {
  if (!url) return '';
  if (url.includes('m.media-amazon.com/images/')) {
    // Strip IMDb/Amazon thumbnail resizing suffix to get original full-res cover
    return url.replace(/@\._V1_.*\.jpg$/, '@.jpg');
  }
  return url;
}

// Cleans search queries for maximum search accuracy
function cleanSearchTitle(title) {
  return title
    .replace(/^British\s+/i, '')
    .replace(/^American\s+/i, '')
    .replace(/\(UK\)$/i, '')
    .replace(/\(US\)$/i, '')
    .trim();
}

// Fetches poster cover from TVMaze search keylessly as a secondary fallback
async function getTvMazeMetadata(title) {
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
      const response = await axios.get(url);
      if (response.data) {
        const largeCover = response.data.image ? (response.data.image.original || response.data.image.medium) : '';
        if (largeCover) return { largeCover };
      }
    } catch (err) {
      // Continue to list search
    }

    // 2. Try list search fallback
    try {
      const fallbackUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
      const resFallback = await axios.get(fallbackUrl);
      if (resFallback.data && resFallback.data.length > 0) {
        const matchingShow = resFallback.data.find(d => d.show && d.show.image);
        if (matchingShow) {
          const largeCover = matchingShow.show.image.original || matchingShow.show.image.medium || '';
          if (largeCover) return { largeCover };
        }
      }
    } catch (e) {
      // Continue to next variation
    }
  }
  return { largeCover: '' };
}

// Scrapes YouTube for trailer URLs keylessly
async function getYoutubeTrailer(title, releaseYear) {
  try {
    const query = encodeURIComponent(`${title} ${releaseYear || ''} official trailer movie`);
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

// Maps movie CSV / TMDb Genres to Notion schema options
function mapGenres(genresArrayOrString) {
  let rawGenres = [];
  if (Array.isArray(genresArrayOrString)) {
    rawGenres = genresArrayOrString;
  } else if (typeof genresArrayOrString === 'string') {
    rawGenres = genresArrayOrString.split('|').map(g => g.trim());
  }

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
      mapped.push('Drama');
    }
  }
  return [...new Set(mapped)];
}

// Parse CSV content into an array of objects
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

// Map movie details to Notion API page insertion format
function buildNotionPage(movie) {
  const properties = {
    'Title': {
      title: [{ text: { content: movie.title } }]
    },
    'Director': {
      rich_text: [{ text: { content: movie.director || 'Unknown' } }]
    },
    'Status': {
      status: { name: 'Inbox' } // Status (status type) -> "Inbox" verified!
    },
    'Synopsis': {
      rich_text: [{ text: { content: (movie.synopsis || '').substring(0, 1900) } }]
    }
  };

  if (movie.releaseYear) {
    properties['ReleaseYear'] = { number: movie.releaseYear };
  }

  if (movie.runtime) {
    properties['Runtime'] = { number: movie.runtime };
  }

  if (movie.imdbRating) {
    properties['IMDbRating'] = { number: movie.imdbRating };
  }

  if (movie.genres && movie.genres.length > 0) {
    properties['Genre'] = {
      multi_select: movie.genres.map(g => ({ name: g }))
    };
  }

  if (movie.trailer) {
    properties['Trailer'] = {
      url: movie.trailer
    };
  }

  const pageData = {
    parent: { database_id: DATABASE_ID },
    properties: properties
  };

  if (movie.coverUrl && movie.coverUrl.startsWith('http')) {
    pageData.cover = {
      type: 'external',
      external: { url: movie.coverUrl }
    };
  }

  return pageData;
}

// Master execution flow
async function start() {
  const targetCount = 10000;

  console.log('====================================================');
  console.log(`🎬 Seeding Notion with Top ${targetCount} Movies Library`);
  console.log('====================================================\n');

  try {
    const existingCache = await fetchNotionCache();
    let currentTotal = existingCache.size;
    console.log(`Current size: ${currentTotal} movies in Notion.\n`);

    if (currentTotal >= targetCount) {
      console.log(`\x1b[32mMovie Database is already at ${currentTotal} items (Goal of ${targetCount} reached!). Skipping execution.\x1b[0m`);
      return;
    }

    let newlyImported = 0;

    if (TMDB_API_KEY && !TMDB_API_KEY.includes('your_tmdb_api_key_here')) {
      // Live TMDb Mode
      console.log('\x1b[32mTMDB_API_KEY detected. Using live TMDb API top_rated list...\x1b[0m\n');
      // Fetch TMDb page by page and insert
      const moviesPerPage = 20;
      const pagesNeeded = Math.ceil(targetCount / moviesPerPage);

      for (let page = 1; page <= pagesNeeded; page++) {
        if (currentTotal + newlyImported >= targetCount) break;
        console.log(`\n\x1b[35m[TMDb Page ${page}/${pagesNeeded}] Fetching top movies...\x1b[0m`);
        
        let res;
        try {
          res = await axios.get('https://api.themoviedb.org/3/movie/top_rated', {
            params: { api_key: TMDB_API_KEY, language: 'en-US', page }
          });
        } catch (e) {
          console.error(`Failed to fetch TMDb page ${page}:`, e.message);
          await sleep(5000);
          continue;
        }

        if (!res.data || !res.data.results || res.data.results.length === 0) continue;

        for (const m of res.data.results) {
          if (currentTotal + newlyImported >= targetCount) break;

          const title = m.title;
          const cacheKey = title.toLowerCase().trim();
          if (existingCache.has(cacheKey)) continue;

          // Fetch full TMDb movie details keylessly/with key for director & trailer & runtime
          let director = 'Unknown';
          let trailer = '';
          let runtime = 0;

          try {
            const [detRes, credRes, vidRes] = await Promise.all([
              axios.get(`https://api.themoviedb.org/3/movie/${m.id}`, { params: { api_key: TMDB_API_KEY } }),
              axios.get(`https://api.themoviedb.org/3/movie/${m.id}/credits`, { params: { api_key: TMDB_API_KEY } }),
              axios.get(`https://api.themoviedb.org/3/movie/${m.id}/videos`, { params: { api_key: TMDB_API_KEY } })
            ]);
            director = credRes.data.crew?.find(c => c.job === 'Director')?.name || 'Unknown';
            trailer = vidRes.data.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key 
              ? `https://www.youtube.com/watch?v=${vidRes.data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube').key}`
              : '';
            runtime = detRes.data.runtime || 0;
          } catch (err) {
            // fallback gracefully
          }

          const movieObj = {
            title: title,
            director: director,
            releaseYear: parseInt(m.release_date?.substring(0, 4) || '0', 10),
            runtime: runtime,
            imdbRating: m.vote_average,
            genres: mapGenres(m.genre_ids ? m.genre_ids.map(id => ({ name: String(id) })) : []), // mapped in builder
            synopsis: m.overview,
            trailer: trailer,
            coverUrl: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : ''
          };

          const pageData = buildNotionPage(movieObj);
          try {
            await notion.pages.create(pageData);
            console.log(`\x1b[32m[Inserted] "${title}" (${movieObj.releaseYear})\x1b[0m`);
            newlyImported++;
            existingCache.set(cacheKey, true);
            await sleep(350);
          } catch (err) {
            console.error(`Failed to insert "${title}":`, err.message);
          }
        }
        await sleep(500);
      }
    } else {
      // Keyless CSV Dataset + OMDb / TVMaze cover upgrades
      console.log('\x1b[33mNo TMDB_API_KEY set. Running high-resolution keyless CSV + OMDb API pipeline...\x1b[0m');
      
      console.log(`Downloading movie CSV from: ${CSV_URL}...`);
      const csvResponse = await axios.get(CSV_URL);
      const csvMovies = parseCSV(csvResponse.data);
      console.log(`Loaded ${csvMovies.length} movies from CSV dataset. Processing...`);

      // Filter down to movies that do not already exist in our database to save processing
      const moviesToSync = csvMovies.filter(m => {
        if (!m.original_title) return false;
        return !existingCache.has(m.original_title.toLowerCase().trim());
      });

      console.log(`Identified ${moviesToSync.length} new movies to import. Starting sync...`);

      for (let i = 0; i < moviesToSync.length; i++) {
        if (currentTotal + newlyImported >= targetCount) break;

        const record = moviesToSync[i];
        const title = record.original_title;
        const imdbId = record.imdb_id;
        const cacheKey = title.toLowerCase().trim();

        console.log(`\n[${i + 1}/${moviesToSync.length}] Processing: "${title}" (${record.release_year})`);
        
        let coverUrl = '';
        let director = record.director || 'Unknown';
        let synopsis = record.overview || '';
        let runtime = parseInt(record.runtime, 10) || 0;
        let imdbRating = parseFloat(record.vote_average) || 0;

        // 1. Fetch pristine HD cover and enrich metadata from OMDb using IMDb ID (completely keyless and exact!)
        if (imdbId && imdbId.startsWith('tt')) {
          try {
            const omdbRes = await axios.get(`http://www.omdbapi.com/?i=${imdbId}&apikey=thewdb`);
            if (omdbRes.data && omdbRes.data.Response === 'True') {
              const data = omdbRes.data;
              if (data.Poster && data.Poster.startsWith('http') && !data.Poster.includes('N/A')) {
                coverUrl = getHighResPoster(data.Poster);
                console.log(`   Found cover on OMDb: ${coverUrl}`);
              }
              if (data.Director && data.Director !== 'N/A') director = data.Director;
              if (data.Plot && data.Plot !== 'N/A') synopsis = data.Plot;
              if (data.Runtime && data.Runtime !== 'N/A') runtime = parseInt(data.Runtime.replace(/\D/g, ''), 10) || runtime;
              if (data.imdbRating && data.imdbRating !== 'N/A') imdbRating = parseFloat(data.imdbRating) || imdbRating;
            }
          } catch (e) {
            // fail silently
          }
        }

        // 2. Secondary fallback cover lookup using TVMaze if OMDb cover is missing
        if (!coverUrl) {
          try {
            const tvMazeData = await getTvMazeMetadata(title);
            if (tvMazeData.largeCover) {
              coverUrl = tvMazeData.largeCover;
              console.log(`   Found cover on TVMaze: ${coverUrl}`);
            }
          } catch (err) {
            // fail silently
          }
        }

        // 3. Resolve Trailer from YouTube keylessly
        let trailer = '';
        try {
          trailer = await getYoutubeTrailer(title, record.release_year);
          if (trailer) console.log(`   Resolved YouTube Trailer: ${trailer}`);
        } catch (err) {
          // fail silently
        }

        const movieObj = {
          title: title,
          director: director,
          releaseYear: parseInt(record.release_year, 10) || null,
          runtime: runtime,
          imdbRating: imdbRating,
          genres: mapGenres(record.genres),
          synopsis: synopsis,
          trailer: trailer,
          coverUrl: coverUrl
        };

        const pageData = buildNotionPage(movieObj);
        try {
          await notion.pages.create(pageData);
          console.log(`   \x1b[32m✅ Successfully Imported Movie!\x1b[0m`);
          newlyImported++;
          existingCache.set(cacheKey, true);
          // Throttling to respect Notion API limits
          await sleep(350);
        } catch (err) {
          console.error(`   Failed to import movie:`, err.message);
        }
      }
    }

    console.log('\n====================================================');
    console.log('\x1b[32m🎉 Movies Catalog Seeding Finished!\x1b[0m');
    console.log(`🟢 Successfully Imported: ${newlyImported} new movie cards.`);
    console.log(`⚪ Total Database Size: ${currentTotal + newlyImported} cards.`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in execution:', error.message);
  }
}

start();
