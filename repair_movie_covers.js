const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const CSV_URL = 'https://raw.githubusercontent.com/krishna-koly/IMDB_TOP_1000/main/imdb_top_1000.csv';

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error('Error: NOTION_TOKEN or NOTION_MOVIE_DATABASE_ID is not configured.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Decodes all HTML entities robustly
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
    const query = encodeURIComponent(`${title} ${releaseYear || ''} official trailer`);
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
      obj[h.trim()] = val;
    });
    records.push(obj);
  }
  return records;
}

async function startRepair() {
  console.log('====================================================');
  console.log('🛠️  Starting Advanced Movie Cover & Entity Sweep...');
  console.log('====================================================');

  let csvMap = new Map();
  try {
    console.log(`Downloading movie dataset from: ${CSV_URL}...`);
    const csvResponse = await axios.get(CSV_URL);
    const movies = parseCSV(csvResponse.data);
    for (const m of movies) {
      if (m.Series_Title) {
        csvMap.set(m.Series_Title.toLowerCase().trim(), m);
      }
    }
    console.log(`Successfully mapped ${csvMap.size} movies from CSV dataset.`);
  } catch (err) {
    console.warn('⚠️ Warning: Failed to download CSV dataset, will rely purely on fallbacks:', err.message);
  }

  let hasMore = true;
  let cursor = undefined;
  let processedCount = 0;
  let repairedCovers = 0;
  let repairedTitles = 0;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        processedCount++;
        let originalTitle = '';
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            originalTitle = prop.title[0].plain_text;
            break;
          }
        }

        if (!originalTitle) continue;

        let decodedTitle = decodeHtmlEntities(originalTitle);
        let hasCover = page.cover !== null;
        let hasTrailer = page.properties.Trailer?.url !== null;
        let releaseYear = page.properties.ReleaseYear?.number || '';

        let needsTitleRepair = originalTitle !== decodedTitle;
        let needsCoverRepair = !hasCover;

        if (needsTitleRepair || needsCoverRepair) {
          console.log(`\nAnalyzing: "${originalTitle}"`);
          const updateData = {
            page_id: page.id,
            properties: {}
          };

          // 1. Repair Title
          if (needsTitleRepair) {
            console.log(`  Decoded Title: \x1b[32m"${decodedTitle}"\x1b[0m`);
            updateData.properties['Title'] = {
              title: [{ text: { content: decodedTitle } }]
            };
            repairedTitles++;
          }

          // 2. Repair Cover Poster
          if (needsCoverRepair) {
            const titleToSearch = decodedTitle;
            console.log(`  Searching cover for: "${titleToSearch}"...`);
            
            // Try CSV Lookup first
            const csvRecord = csvMap.get(titleToSearch.toLowerCase().trim());
            let resolvedCover = '';

            if (csvRecord && csvRecord.Poster_Link) {
              resolvedCover = getHighResPoster(csvRecord.Poster_Link);
              console.log(`  \x1b[32mFound Cover in CSV:\x1b[0m ${resolvedCover}`);
            } else {
              // Try TVMaze fallback search
              console.log(`  Not found in CSV, searching TVMaze fallback...`);
              const metadata = await getTvMazeMetadata(titleToSearch);
              if (metadata.largeCover) {
                resolvedCover = metadata.largeCover;
                console.log(`  \x1b[32mFound Cover on TVMaze:\x1b[0m ${resolvedCover}`);
              }
            }

            if (resolvedCover) {
              updateData.cover = {
                type: 'external',
                external: { url: resolvedCover }
              };
              repairedCovers++;
            } else {
              console.log(`  \x1b[31m⚠️  Failed to resolve cover for "${titleToSearch}"\x1b[0m`);
            }
          }

          // 3. Repair Trailer (if missing)
          if (!hasTrailer) {
            const titleToSearch = decodedTitle;
            console.log(`  Searching YouTube trailer for: "${titleToSearch}"...`);
            const trailerUrl = await getYoutubeTrailer(titleToSearch, releaseYear);
            if (trailerUrl) {
              console.log(`  \x1b[32mFound Trailer:\x1b[0m ${trailerUrl}`);
              updateData.properties['Trailer'] = {
                url: trailerUrl
              };
            }
          }

          // Write updates in Notion
          try {
            await notion.pages.update(updateData);
            // safe limit delay
            await sleep(350);
          } catch (e) {
            console.error(`  Error updating page in Notion:`, e.message);
          }
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    console.log('\n====================================================');
    console.log('🎉 Advanced Movie Cover & Entity Sweep Complete!');
    console.log(`🟢 Successfully Repaired Titles: ${repairedTitles}`);
    console.log(`🟢 Successfully Repaired Covers: ${repairedCovers}`);
    console.log(`⚪ Total Pages Processed: ${processedCount}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in repair script:', error.message);
  }
}

startRepair();
