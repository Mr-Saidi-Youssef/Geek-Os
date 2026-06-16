/**
 * restore_by_recreation.js
 * Programmatically re-creates the 5 Western animation false positives in Movie Library database.
 * Fetches standard high-fidelity metadata keylessly from OMDb API.
 * Uses optimized direct database query filters for peak performance.
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MOVIE_DB_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';

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
  if (!url || url === 'N/A') return '';
  if (url.includes('m.media-amazon.com/images/')) {
    return url.replace(/@\._V1_.*\.jpg$/, '@.jpg');
  }
  return url;
}

// Maps movie CSV / TMDb Genres to Notion schema options
function mapGenres(genresArrayOrString) {
  let rawGenres = [];
  if (Array.isArray(genresArrayOrString)) {
    rawGenres = genresArrayOrString;
  } else if (typeof genresArrayOrString === 'string') {
    rawGenres = genresArrayOrString.split(',').map(g => g.trim());
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
  
  // Ensure "Animation" is always added if it was flagged as anime/cartoon
  mapped.push('Animation');
  
  return [...new Set(mapped)];
}

// Checks if a movie page is active in Notion using database query filters
async function checkMovieExists(title) {
  try {
    const cleanTitle = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const shorterTitle = cleanTitle.split(':')[0].trim();

    const response = await notion.databases.query({
      database_id: MOVIE_DB_ID,
      filter: {
        or: [
          {
            property: 'Title',
            title: {
              equals: title
            }
          },
          {
            property: 'Title',
            title: {
              equals: cleanTitle
            }
          },
          {
            property: 'Title',
            title: {
              equals: shorterTitle
            }
          }
        ]
      }
    });

    return response.results.length > 0;
  } catch (err) {
    console.error(`Error checking existence of "${title}":`, err.message);
    return false;
  }
}

async function restoreMovie(title) {
  console.log(`\n🔍 Fetching OMDb metadata for: "${title}"...`);
  try {
    const cleanTitle = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(cleanTitle)}&type=movie&apikey=thewdb`;
    const response = await axios.get(url, { timeout: 6000 });
    
    if (response.data && response.data.Response !== 'False') {
      const data = response.data;
      const movieObj = {
        title: data.Title || title,
        director: data.Director && data.Director !== 'N/A' ? data.Director : 'Unknown',
        releaseYear: parseInt(data.Year) || 2000,
        runtime: parseInt(data.Runtime) || 0,
        imdbRating: parseFloat(data.imdbRating) || 0.0,
        synopsis: decodeHtmlEntities(data.Plot && data.Plot !== 'N/A' ? data.Plot : ''),
        genres: mapGenres(data.Genre || 'Animation'),
        coverUrl: getHighResPoster(data.Poster),
        trailer: ''
      };

      console.log(`  -> 🟢 OMDb metadata resolved:`);
      console.log(`      Title: "${movieObj.title}"`);
      console.log(`      Director: "${movieObj.director}"`);
      console.log(`      Year: ${movieObj.releaseYear} | Runtime: ${movieObj.runtime} min | IMDb: ${movieObj.imdbRating}`);
      console.log(`      Genres: [${movieObj.genres.join(', ')}]`);
      console.log(`      Poster URL: ${movieObj.coverUrl || 'None'}`);

      console.log(`  -> ⚡ Creating new active page in Notion...`);
      const properties = {
        'Title': {
          title: [{ text: { content: movieObj.title } }]
        },
        'Director': {
          rich_text: [{ text: { content: movieObj.director } }]
        },
        'ReleaseYear': {
          number: movieObj.releaseYear
        },
        'Runtime': {
          number: movieObj.runtime
        },
        'IMDbRating': {
          number: movieObj.imdbRating
        },
        'Status': {
          status: { name: 'Inbox' }
        },
        'Synopsis': {
          rich_text: [{ text: { content: movieObj.synopsis.substring(0, 1900) } }]
        },
        'Genre': {
          multi_select: movieObj.genres.map(g => ({ name: g }))
        }
      };

      const pageData = {
        parent: { database_id: MOVIE_DB_ID },
        properties: properties
      };

      if (movieObj.coverUrl) {
        pageData.cover = {
          type: 'external',
          external: { url: movieObj.coverUrl }
        };
      }

      await notion.pages.create(pageData);
      console.log(`  -> 🎉 Successfully created "${movieObj.title}" in Notion Movie Library!`);
    } else {
      console.warn(`  -> ⚠️  OMDb failed to find details for: "${title}". Using manual fallback.`);
      await createManualFallback(title);
    }
  } catch (err) {
    console.error(`  -> ❌ Failed to recreate movie "${title}":`, err.message);
  }
}

async function createManualFallback(title) {
  console.log(`  -> 🛠 Creating manual fallback for "${title}"...`);
  const properties = {
    'Title': {
      title: [{ text: { content: title } }]
    },
    'Director': {
      rich_text: [{ text: { content: 'Unknown' } }]
    },
    'Status': {
      status: { name: 'Inbox' }
    },
    'Genre': {
      multi_select: [{ name: 'Animation' }]
    }
  };

  await notion.pages.create({
    parent: { database_id: MOVIE_DB_ID },
    properties: properties
  });
  console.log(`  -> 🎉 Fallback page created!`);
}

async function run() {
  console.log('====================================================');
  console.log('🔄 RESTORING WESTERN MASTERPIECES BY RECREATION');
  console.log('====================================================');

  for (const title of FALSE_POSITIVES) {
    console.log(`Checking existence of "${title}" in Notion...`);
    const exists = await checkMovieExists(title);

    if (exists) {
      console.log(`⚪ Movie "${title}" is already active in database. Skipping.`);
    } else {
      await restoreMovie(title);
      await sleep(1000); // polite Notion rate limit throttle
    }
  }

  console.log('\n====================================================');
  console.log('🎉 RECREATION & RESTORE PROCESS COMPLETED!');
  console.log('====================================================\n');
}

run();
