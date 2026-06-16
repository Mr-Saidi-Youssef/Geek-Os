/**
 * TMDb to Notion Top 1000 Movies Importer
 * Powered by TMDb API & Official Notion Client
 * Developed for Byronotion Movies Collection
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

// Initialize Notion Client
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fallback dataset of top cinematic masterpieces (used if TMDB_API_KEY is not defined)
const fallbackMovies = [
  {
    title: 'The Shawshank Redemption',
    director: 'Frank Darabont',
    releaseYear: 1994,
    runtime: 142,
    imdbRating: 9.3,
    status: '🍿 To Watch',
    genres: ['Drama'],
    platforms: ['Prime Video', 'Netflix'],
    trailer: 'https://www.youtube.com/watch?v=PLl99DlL6b4',
    synopsis: 'Over the course of several years, two convicts form a friendship, seeking consolation and, eventually, redemption through basic compassion.'
  },
  {
    title: 'The Godfather',
    director: 'Francis Ford Coppola',
    releaseYear: 1972,
    runtime: 175,
    imdbRating: 9.2,
    status: '🍿 To Watch',
    genres: ['Crime', 'Drama'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=UaVTIH8mujA',
    synopsis: 'The aging patriarch of an organized crime dynasty in postwar New York City transfers control of his clandestine empire to his reluctant youngest son.'
  },
  {
    title: 'The Dark Knight',
    director: 'Christopher Nolan',
    releaseYear: 2008,
    runtime: 152,
    imdbRating: 9.0,
    status: '🍿 To Watch',
    genres: ['Action & Adventure', 'Crime', 'Drama', 'Thriller'],
    platforms: ['Netflix', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=LDG9bisJEaI',
    synopsis: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.'
  },
  {
    title: 'Pulp Fiction',
    director: 'Quentin Tarantino',
    releaseYear: 1994,
    runtime: 154,
    imdbRating: 8.9,
    status: '🍿 To Watch',
    genres: ['Crime', 'Drama'],
    platforms: ['Netflix', 'Prime Video'],
    trailer: 'https://www.youtube.com/watch?v=s7EdQ4FqbhY',
    synopsis: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.'
  },
  {
    title: 'Schindler\'s List',
    director: 'Steven Spielberg',
    releaseYear: 1993,
    runtime: 195,
    imdbRating: 9.0,
    status: '🍿 To Watch',
    genres: ['Drama'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=gG22XNhtnoY',
    synopsis: 'In German-occupied Poland during World War II, industrialist Oskar Schindler gradually becomes concerned for his Jewish workforce after witnessing their persecution by the Nazis.'
  },
  {
    title: 'Inception',
    director: 'Christopher Nolan',
    releaseYear: 2010,
    runtime: 148,
    imdbRating: 8.8,
    status: '🍿 To Watch',
    genres: ['Action & Adventure', 'Sci-Fi', 'Thriller'],
    platforms: ['Netflix', 'Prime Video'],
    trailer: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
    synopsis: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O., but his tragic past may doom the project.'
  },
  {
    title: 'Interstellar',
    director: 'Christopher Nolan',
    releaseYear: 2014,
    runtime: 169,
    imdbRating: 8.7,
    status: '🍿 To Watch',
    genres: ['Sci-Fi', 'Drama'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=zSWdZATo3cA',
    synopsis: 'When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot, Joseph Cooper, is tasked to pilot a spacecraft, along with a team of researchers, to find a new planet for humans.'
  }
];

// Helper: HTTP GET request with retries for TMDb rate limits (429)
async function getWithRetry(url, params = {}, retries = 3, delayMs = 1500) {
  try {
    return await axios.get(url, { params });
  } catch (error) {
    if (error.response && error.response.status === 429 && retries > 0) {
      console.warn(`\x1b[33m  [TMDb 429 Rate Limit] Waiting ${delayMs}ms before retrying...\x1b[0m`);
      await sleep(delayMs);
      return getWithRetry(url, params, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

// Maps TMDb Genres to Notion schema options
function mapTmdbGenres(genres) {
  const allowed = new Set(['Action & Adventure', 'Sci-Fi', 'Drama', 'Thriller', 'Romance', 'Comedy', 'Animation', 'Horror', 'Crime', 'Fantasy']);
  const mapped = [];

  for (const g of genres) {
    const name = g.name;
    if (allowed.has(name)) {
      mapped.push(name);
    } else if (name === 'Science Fiction') {
      mapped.push('Sci-Fi');
    } else if (name === 'Action' || name === 'Adventure') {
      mapped.push('Action & Adventure');
    } else if (name === 'Mystery') {
      mapped.push('Thriller');
    } else if (name === 'War') {
      mapped.push('Action & Adventure');
    } else if (name === 'Family') {
      mapped.push('Fantasy');
    }
  }
  return [...new Set(mapped)];
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

// Map a movie object to Notion API properties
function buildNotionProperties(movie) {
  const properties = {
    'Title': {
      title: [{ text: { content: movie.title } }]
    },
    'Director': {
      rich_text: [{ text: { content: movie.director || 'Unknown' } }]
    },
    'ReleaseYear': {
      number: movie.releaseYear
    },
    'Runtime': {
      number: movie.runtime || 0
    },
    'IMDbRating': {
      number: movie.imdbRating
    },
    'Status': {
      select: { name: movie.status || '🍿 To Watch' }
    },
    'Synopsis': {
      rich_text: [{ text: { content: (movie.synopsis || '').substring(0, 1900) } }]
    }
  };

  if (movie.genres && movie.genres.length > 0) {
    properties['Genre'] = {
      multi_select: movie.genres.map(g => ({ name: g }))
    };
  }

  if (movie.platforms && movie.platforms.length > 0) {
    properties['Platform'] = {
      multi_select: movie.platforms.map(p => ({ name: p }))
    };
  }

  if (movie.trailer) {
    properties['Trailer'] = {
      url: movie.trailer
    };
  }

  return properties;
}

// Concurrency queue to fetch movie details (runtimes, directors, trailers) in parallel
async function resolveMoviesMetadata(briefMovies, apiKey, concurrencyLimit = 10) {
  console.log(`Resolving full metadata for ${briefMovies.length} movies with a concurrency limit of ${concurrencyLimit}...`);
  const resolved = [];
  const total = briefMovies.length;

  for (let i = 0; i < total; i += concurrencyLimit) {
    const chunk = briefMovies.slice(i, i + concurrencyLimit);
    const promises = chunk.map(async (m, index) => {
      const idx = i + index + 1;
      const movieId = m.id;
      const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}`;
      const creditsUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits`;
      const videosUrl = `https://api.themoviedb.org/3/movie/${movieId}/videos`;

      try {
        const [detailsRes, creditsRes, videosRes] = await Promise.all([
          getWithRetry(detailsUrl, { api_key: apiKey, language: 'en-US' }),
          getWithRetry(creditsUrl, { api_key: apiKey }),
          getWithRetry(videosUrl, { api_key: apiKey })
        ]);

        const details = detailsRes.data;
        const credits = creditsRes.data;
        const videos = videosRes.data;

        // Director
        const director = credits.crew?.find(c => c.job === 'Director')?.name || 'Unknown';
        
        // Trailer
        const trailerKey = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')?.key;
        const trailer = trailerKey ? `https://www.youtube.com/watch?v=${trailerKey}` : '';

        // Cover Path
        const coverUrl = m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '';

        const fullMovie = {
          title: m.title,
          director: director,
          releaseYear: parseInt(m.release_date?.substring(0, 4) || '0', 10),
          runtime: details.runtime,
          imdbRating: m.vote_average,
          status: '🍿 To Watch',
          genres: mapTmdbGenres(details.genres || []),
          synopsis: m.overview,
          trailer: trailer,
          coverUrl: coverUrl
        };

        resolved.push(fullMovie);
        if (idx % 20 === 0 || idx === total) {
          console.log(`  [Resolved] ${idx}/${total} movies fully populated...`);
        }
      } catch (err) {
        console.error(`\x1b[31m  Failed to resolve metadata for "${m.title}":\x1b[0m`, err.message);
      }
    });

    await Promise.all(promises);
    // Small sleep between chunks to stay compliant
    await sleep(200);
  }

  return resolved;
}

// Master Execution Flow
async function start() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('====================================================');
  console.log('\x1b[35m🎬 Top 1000 Movies Importer (TMDb -> Notion)\x1b[0m');
  console.log('====================================================');
  if (isDryRun) {
    console.log('\x1b[33m*** DRY RUN MODE (No API calls will be made to Notion) ***\x1b[0m\n');
  }

  try {
    let moviesToSync = [];

    if (!TMDB_API_KEY || TMDB_API_KEY.includes('your_tmdb_api_key_here')) {
      console.warn('\x1b[33mWarning: TMDB_API_KEY is not configured in your .env file.\x1b[0m');
      console.warn('\x1b[36mFalling back to the premium local seed dataset...\x1b[0m\n');
      moviesToSync = fallbackMovies;
    } else {
      console.log('\x1b[32mTMDb API Key detected. Fetching top 1000 movies from live TMDb list...\x1b[0m\n');
      let briefMovies = [];
      const targetCount = 1000;
      const moviesPerPage = 20;
      const pagesNeeded = Math.ceil(targetCount / moviesPerPage); // 50 pages

      console.log(`Fetching 50 pages from TMDb top_rated API...`);
      for (let page = 1; page <= pagesNeeded; page++) {
        const listUrl = 'https://api.themoviedb.org/3/movie/top_rated';
        try {
          const res = await getWithRetry(listUrl, { api_key: TMDB_API_KEY, language: 'en-US', page });
          if (res.data && res.data.results) {
            briefMovies = briefMovies.concat(res.data.results);
          }
          if (page % 10 === 0 || page === pagesNeeded) {
            console.log(`  [Fetched] Page ${page}/${pagesNeeded} (${briefMovies.length} movie entries)...`);
          }
          await sleep(150); // respect TMDb limits
        } catch (e) {
          console.error(`\x1b[31m  Failed to fetch top_rated page ${page}:\x1b[0m`, e.message);
          break;
        }
      }

      briefMovies = briefMovies.slice(0, targetCount);
      console.log(`\nSuccessfully loaded ${briefMovies.length} movie titles from TMDb!`);
      
      // Resolve directors, runtimes, trailers concurrently
      moviesToSync = await resolveMoviesMetadata(briefMovies, TMDB_API_KEY, 10);
    }

    // Connect to Notion Cache
    let existingCache = new Map();
    if (!isDryRun) {
      existingCache = await fetchNotionCache();
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    console.log(`\nSyncing ${moviesToSync.length} movies to Notion (safe rate-limiting active)...`);
    
    for (const movie of moviesToSync) {
      const cacheKey = movie.title.toLowerCase().trim();
      const existingPageId = existingCache.get(cacheKey);

      if (isDryRun) {
        console.log(`\x1b[36m[Dry-Run] Title: "${movie.title}" (${movie.releaseYear})\x1b[0m`);
        console.log(`  Director: ${movie.director} | Runtime: ${movie.runtime}m | Rating: ${movie.imdbRating}`);
        console.log(`  Genres: [${movie.genres.join(', ')}] | Trailer: ${movie.trailer || 'N/A'}`);
        console.log(`  Synopsis: "${(movie.synopsis || '').substring(0, 100)}..."`);
        console.log('----------------------------------------------------');
        continue;
      }

      const properties = buildNotionProperties(movie);

      try {
        if (existingPageId) {
          // Update
          console.log(`\x1b[33m[Updating] "${movie.title}" (${movie.releaseYear}) in Notion...\x1b[0m`);
          await notion.pages.update({
            page_id: existingPageId,
            properties: properties
          });
          updatedCount++;
        } else {
          // Insert
          console.log(`\x1b[32m[Inserting] "${movie.title}" (IMDb: ${movie.imdbRating}) into Notion...\x1b[0m`);
          const pageData = {
            parent: { database_id: DATABASE_ID },
            properties: properties
          };
          if (movie.coverUrl) {
            pageData.cover = {
              type: 'external',
              external: { url: movie.coverUrl }
            };
          }
          await notion.pages.create(pageData);
          insertedCount++;
        }
        // Small rate-limit delay (350ms) to respect Notion limits (3 write requests per second)
        await sleep(350);
      } catch (err) {
        console.error(`\x1b[31m  Failed to sync "${movie.title}" to Notion:\x1b[0m`, err.message);
      }
    }

    console.log('\n====================================================');
    console.log('\x1b[32m🎉 Top 1000 Movies Sync Cycle Complete!\x1b[0m');
    if (isDryRun) {
      console.log(`🟢 Dry-run validated ${moviesToSync.length} movie mappings.`);
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
