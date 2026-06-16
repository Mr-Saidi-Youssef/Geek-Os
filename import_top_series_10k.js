/**
 * Seeder for TV Series Library - 10,000 Entries Scale-up
 * Powered by TMDB API OR Mainak TV Shows CSV + TVMaze Paginated Stream (Keyless)
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const CSV_URL = 'https://raw.githubusercontent.com/MainakRepositor/Datasets/master/TV_Shows.csv';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

// Initialize Notion Client
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Strip HTML tags from TVMaze summary descriptions
function stripHtml(htmlString) {
  if (!htmlString) return '';
  return htmlString.replace(/<[^>]*>/g, '');
}

// Maps TV Genres to Notion TV Series genres schema options
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

// Cleans search queries for maximum TVMaze singlesearch accuracy
function cleanSearchTitle(title) {
  return title
    .replace(/^British\s+/i, '')
    .replace(/^American\s+/i, '')
    .replace(/^Stephen King's\s+/i, '')
    .replace(/\(UK\)$/i, '')
    .replace(/\(US\)$/i, '')
    .replace(/Black-Adder/i, 'Blackadder')
    .replace(/Black Adder/i, 'Blackadder')
    .trim();
}

// Fetches TV Series poster, platform, genres, seasons, and episodes keylessly in a single call via TVMaze Singlesearch
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
    try {
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(q)}&embed=episodes`;
      const response = await axios.get(url);
      if (response.data) {
        const data = response.data;
        const largeCover = data.image ? (data.image.original || data.image.medium) : '';
        const network = data.network ? data.network.name : (data.webChannel ? data.webChannel.name : '');
        const genres = data.genres || [];
        const premiered = data.premiered ? parseInt(data.premiered.substring(0, 4), 10) : null;
        const rating = data.rating ? data.rating.average : null;
        const runtime = data.runtime || null;
        const summary = stripHtml(data.summary || '');
        
        let totalEpisodes = null;
        let totalSeasons = null;
        if (data._embedded && data._embedded.episodes) {
          const episodes = data._embedded.episodes;
          totalEpisodes = episodes.length;
          totalSeasons = new Set(episodes.map(e => e.season)).size;
        }

        return {
          largeCover,
          network,
          genres,
          premiered,
          rating,
          runtime,
          summary,
          totalEpisodes,
          totalSeasons,
          found: true
        };
      }
    } catch (err) {
      // Fall through to next query variation
    }
  }
  return { found: false };
}

// Scrapes YouTube for TV series trailer links keylessly
async function getYoutubeTrailer(title, releaseYear) {
  try {
    const query = encodeURIComponent(`${title} ${releaseYear || ''} official trailer tv series`);
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
      obj[h.trim()] = val;
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

// Map a series object to Notion TV series schema properties
function buildNotionPage(series) {
  const properties = {
    'Title': {
      title: [{ text: { content: series.title } }]
    },
    'Status': {
      status: { name: 'Inbox' } // Status (status type) -> "Inbox" verified!
    },
    'Synopsis': {
      rich_text: [{ text: { content: (series.synopsis || '').substring(0, 1900) } }]
    }
  };

  if (series.releaseYear) {
    properties['ReleaseYear'] = { number: series.releaseYear };
  }

  if (series.runtime) {
    properties['Runtime'] = { number: series.runtime };
  }

  if (series.imdbRating) {
    properties['IMDbRating'] = { number: series.imdbRating };
  }

  if (series.seasons) {
    properties['Seasons'] = { number: series.seasons };
  }

  if (series.episodes) {
    properties['Total Episodes'] = { number: series.episodes };
  }

  if (series.genres && series.genres.length > 0) {
    properties['Genre'] = {
      multi_select: series.genres.map(g => ({ name: g }))
    };
  }

  if (series.platform) {
    properties['Platform'] = {
      multi_select: [{ name: series.platform }]
    };
  }

  if (series.trailer) {
    properties['Trailer'] = {
      url: series.trailer
    };
  }

  const pageData = {
    parent: { database_id: DATABASE_ID },
    properties: properties
  };

  if (series.coverUrl && series.coverUrl.startsWith('http')) {
    pageData.cover = {
      type: 'external',
      external: { url: series.coverUrl }
    };
  }

  return pageData;
}

// Master execution flow
async function start() {
  const targetCount = 10000;

  console.log('====================================================');
  console.log(`🎬 Seeding Notion with Top ${targetCount} TV Series Library`);
  console.log('====================================================\n');

  try {
    const existingCache = await fetchNotionCache();
    let currentTotal = existingCache.size;
    console.log(`Current size: ${currentTotal} series in Notion.\n`);

    if (currentTotal >= targetCount) {
      console.log(`\x1b[32mTV Series Database is already at ${currentTotal} items (Goal of ${targetCount} reached!). Skipping execution.\x1b[0m`);
      return;
    }

    let newlyImported = 0;

    if (TMDB_API_KEY && !TMDB_API_KEY.includes('your_tmdb_api_key_here')) {
      // Live TMDb TV Series Mode
      console.log('\x1b[32mTMDB_API_KEY detected. Using live TMDb API top_rated TV list...\x1b[0m\n');
      const seriesPerPage = 20;
      const pagesNeeded = Math.ceil(targetCount / seriesPerPage);

      for (let page = 1; page <= pagesNeeded; page++) {
        if (currentTotal + newlyImported >= targetCount) break;
        console.log(`\n\x1b[35m[TMDb TV Page ${page}/${pagesNeeded}] Fetching top series...\x1b[0m`);
        
        let res;
        try {
          res = await axios.get('https://api.themoviedb.org/3/tv/top_rated', {
            params: { api_key: TMDB_API_KEY, language: 'en-US', page }
          });
        } catch (e) {
          console.error(`Failed to fetch TMDb TV page ${page}:`, e.message);
          await sleep(5000);
          continue;
        }

        if (!res.data || !res.data.results || res.data.results.length === 0) continue;

        for (const show of res.data.results) {
          if (currentTotal + newlyImported >= targetCount) break;

          const title = show.name;
          const cacheKey = title.toLowerCase().trim();
          if (existingCache.has(cacheKey)) continue;

          // Fetch full TMDb show details for seasons, episodes, platforms, and trailer
          let platform = '';
          let seasons = 0;
          let episodes = 0;
          let trailer = '';
          let runtime = 0;

          try {
            const [detRes, vidRes] = await Promise.all([
              axios.get(`https://api.themoviedb.org/3/tv/${show.id}`, { params: { api_key: TMDB_API_KEY } }),
              axios.get(`https://api.themoviedb.org/3/tv/${show.id}/videos`, { params: { api_key: TMDB_API_KEY } })
            ]);
            
            const details = detRes.data;
            seasons = details.number_of_seasons || 0;
            episodes = details.number_of_episodes || 0;
            runtime = details.episode_run_time?.[0] || 0;
            platform = details.networks?.[0]?.name || '';
            
            trailer = vidRes.data.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key
              ? `https://www.youtube.com/watch?v=${vidRes.data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube').key}`
              : '';
          } catch (err) {
            // fallback gracefully
          }

          const seriesObj = {
            title: title,
            releaseYear: parseInt(show.first_air_date?.substring(0, 4) || '0', 10),
            runtime: runtime,
            imdbRating: show.vote_average,
            seasons: seasons,
            episodes: episodes,
            genres: mapGenres(show.genre_ids ? show.genre_ids.map(id => ({ name: String(id) })) : []), // mapped in builder
            synopsis: show.overview,
            platform: platform,
            trailer: trailer,
            coverUrl: show.poster_path ? `https://image.tmdb.org/t/p/w500${show.poster_path}` : ''
          };

          const pageData = buildNotionPage(seriesObj);
          try {
            await notion.pages.create(pageData);
            console.log(`\x1b[32m[Inserted] "${title}" (${seriesObj.releaseYear})\x1b[0m`);
            newlyImported++;
            existingCache.set(cacheKey, true);
            await sleep(350);
          } catch (err) {
            console.error(`Failed to insert TV show "${title}":`, err.message);
          }
        }
        await sleep(500);
      }
    } else {
      // Keyless CSV Dataset + TVMaze Paginated Stream Mode
      console.log('\x1b[33mNo TMDB_API_KEY set. Running TV Shows CSV + TVMaze Paginated Stream pipeline...\x1b[0m');
      
      const seriesQueue = [];
      const titleTracker = new Set();

      // 1. Load Mainak's CSV dataset (5,613 shows)
      try {
        console.log(`Downloading TV Series CSV from: ${CSV_URL}...`);
        const csvRes = await axios.get(CSV_URL);
        const csvShows = parseCSV(csvRes.data);
        console.log(`Loaded ${csvShows.length} shows from Mainak CSV.`);
        for (const show of csvShows) {
          if (show.Title && !titleTracker.has(show.Title.toLowerCase().trim())) {
            seriesQueue.push({
              title: show.Title,
              year: parseInt(show.Year, 10) || null,
              imdb: parseFloat(show.IMDb) || null,
              netflix: parseInt(show.Netflix, 10) === 1,
              hulu: parseInt(show.Hulu, 10) === 1,
              prime: parseInt(show.PrimeVideo, 10) === 1,
              disney: parseInt(show.Disney, 10) === 1
            });
            titleTracker.add(show.Title.toLowerCase().trim());
          }
        }
      } catch (err) {
        console.warn('⚠️ Warning: Failed to download CSV dataset:', err.message);
      }

      // 2. Stream from TVMaze Paginated Shows endpoint to hit 10,000+ entries!
      console.log(`Streaming extra TV series from TVMaze page-by-page to populate remainder up to 10,000 entries...`);
      for (let page = 0; page <= 30; page++) {
        if (seriesQueue.length >= 12000) break; // Fetch a buffer
        try {
          console.log(`  [TVMaze Fetch] Retrieving page ${page}/30...`);
          const tvMazePageRes = await axios.get(`https://api.tvmaze.com/shows?page=${page}`);
          if (tvMazePageRes.data && tvMazePageRes.data.length > 0) {
            for (const show of tvMazePageRes.data) {
              const name = show.name;
              if (name && !titleTracker.has(name.toLowerCase().trim())) {
                seriesQueue.push({
                  title: name,
                  year: show.premiered ? parseInt(show.premiered.substring(0, 4), 10) : null,
                  imdb: show.rating ? show.rating.average : null
                });
                titleTracker.add(name.toLowerCase().trim());
              }
            }
          }
          await sleep(500); // respect TVMaze limits
        } catch (e) {
          console.error(`Failed to fetch TVMaze page ${page}:`, e.message);
          break;
        }
      }

      console.log(`\nQueue holds ${seriesQueue.length} unique TV series. Filtering against Notion cache...`);

      // Filter against Notion cache
      const showsToSync = seriesQueue.filter(s => !existingCache.has(s.title.toLowerCase().trim()));
      console.log(`Found ${showsToSync.length} new TV series to import into Notion. Starting sync...`);

      for (let i = 0; i < showsToSync.length; i++) {
        if (currentTotal + newlyImported >= targetCount) break;

        const record = showsToSync[i];
        const title = record.title;
        const cacheKey = title.toLowerCase().trim();

        console.log(`\n[${i + 1}/${showsToSync.length}] Processing TV Show: "${title}" (${record.year || 'N/A'})`);

        // Fetch detailed metadata keylessly using TVMaze Singlesearch with embedded episodes!
        console.log(`   Querying TVMaze metadata & episodes count...`);
        const metadata = await getTvMazeMetadata(title);
        
        let coverUrl = '';
        let platform = '';
        let genres = [];
        let releaseYear = record.year;
        let runtime = null;
        let imdbRating = record.imdb;
        let synopsis = '';
        let seasons = null;
        let episodes = null;

        if (metadata.found) {
          coverUrl = metadata.largeCover;
          if (metadata.network) platform = metadata.network;
          genres = mapGenres(metadata.genres);
          if (metadata.premiered) releaseYear = metadata.premiered;
          if (metadata.runtime) runtime = metadata.runtime;
          if (metadata.rating) imdbRating = metadata.rating;
          if (metadata.summary) synopsis = metadata.summary;
          if (metadata.totalEpisodes) episodes = metadata.totalEpisodes;
          if (metadata.totalSeasons) seasons = metadata.totalSeasons;
          console.log(`   ✅ TVMaze Rich Metadata found: ${episodes} episodes, ${seasons} seasons, Cover: ${!!coverUrl}, Platform: ${platform || 'none'}`);
        } else {
          console.log(`   ⚠️ No TVMaze singlesearch entry found. Importing with basic info.`);
          // Basic platform resolve from CSV flags if TVMaze didn't find it
          if (record.netflix) platform = 'Netflix';
          else if (record.hulu) platform = 'Hulu';
          else if (record.prime) platform = 'Prime Video';
          else if (record.disney) platform = 'Disney+';
        }

        // Fetch Youtube trailer keylessly
        let trailer = '';
        try {
          trailer = await getYoutubeTrailer(title, releaseYear);
          if (trailer) console.log(`   Resolved Trailer: ${trailer}`);
        } catch (e) {
          // fail silently
        }

        const seriesObj = {
          title: title,
          releaseYear: releaseYear,
          runtime: runtime,
          imdbRating: imdbRating,
          seasons: seasons,
          episodes: episodes,
          genres: genres,
          platform: platform,
          trailer: trailer,
          coverUrl: coverUrl
        };

        const pageData = buildNotionPage(seriesObj);
        try {
          await notion.pages.create(pageData);
          console.log(`   \x1b[32m✅ Successfully Imported TV Series!\x1b[0m`);
          newlyImported++;
          existingCache.set(cacheKey, true);
          // Rate limit delay to respect Notion write rate
          await sleep(350);
        } catch (err) {
          console.error(`   Failed to import TV Series:`, err.message);
        }
      }
    }

    console.log('\n====================================================');
    console.log('\x1b[32m🎉 TV Series Catalog Seeding Finished!\x1b[0m');
    console.log(`🟢 Successfully Imported: ${newlyImported} new TV series.`);
    console.log(`⚪ Total Database Size: ${currentTotal + newlyImported} cards.`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in execution:', error.message);
  }
}

start();
