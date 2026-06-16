/**
 * Master Movie & TV Series Cover Repair Sweep
 * Scans the Movie and TV Series databases in Notion for missing covers,
 * resolves them keylessly using OMDb, TVMaze, and Wikipedia HTML infobox upscaling fallbacks,
 * and updates their Notion cards.
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MOVIE_DB_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const TV_DB_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Decode all HTML entities robustly
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

// Cleans search queries for maximum matching accuracy
function cleanSearchTitle(title) {
  return title
    .replace(/^British\s+/i, '')
    .replace(/^American\s+/i, '')
    .replace(/\(UK\)$/i, '')
    .replace(/\(US\)$/i, '')
    .trim();
}

// 1. Fetches cover from OMDb API keylessly
async function getOmdbCover(title, isMovie = true) {
  const typeParam = isMovie ? 'movie' : 'series';
  const queryAttempts = [
    title,
    title.replace(/^(The)\s+/i, '').trim(),
    cleanSearchTitle(title),
    title.split(':')[0].trim(),
    title.split('/')[0].trim()
  ];
  
  const uniqueQueries = [...new Set(queryAttempts.map(q => q.trim()).filter(Boolean))];
  
  for (const q of uniqueQueries) {
    try {
      const url = `http://www.omdbapi.com/?t=${encodeURIComponent(q)}&type=${typeParam}&apikey=thewdb`;
      const res = await axios.get(url, { timeout: 5000 });
      if (res.data && res.data.Poster && res.data.Poster.startsWith('http') && !res.data.Poster.includes('N/A')) {
        return getHighResPoster(res.data.Poster);
      }
    } catch (err) {
      // Continue to next variation
    }
  }
  return '';
}

// 2. Fetches cover from TVMaze search keylessly
async function getTvMazeCover(title) {
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
    
    // Try singlesearch first
    try {
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(q)}`;
      const response = await axios.get(url, { timeout: 5000 });
      if (response.data) {
        const largeCover = response.data.image ? (response.data.image.original || response.data.image.medium) : '';
        if (largeCover) return largeCover;
      }
    } catch (err) {
      // Continue to list search
    }

    // Try list search fallback
    try {
      const fallbackUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
      const resFallback = await axios.get(fallbackUrl, { timeout: 5000 });
      if (resFallback.data && resFallback.data.length > 0) {
        const matchingShow = resFallback.data.find(d => d.show && d.show.image);
        if (matchingShow) {
          const largeCover = matchingShow.show.image.original || matchingShow.show.image.medium || '';
          if (largeCover) return largeCover;
        }
      }
    } catch (e) {
      // Continue to next variation
    }
  }
  return '';
}

// 3. Dynamic Wikipedia HTML search -> Infobox cover extraction & upscaling (Ultimate Fallback)
async function resolveWikipediaCoverHTML(title, isMovie = true) {
  try {
    const typeLabel = isMovie ? 'film' : 'television series';
    const cleanTitle = title.replace(/\([^)]+\)/g, '').trim();
    const searchUrl = `https://en.wikipedia.org/w/api.php`;
    
    const searchRes = await axios.get(searchUrl, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: `${cleanTitle} ${typeLabel}`,
        format: 'json',
        utf8: 1
      },
      headers: {
        'User-Agent': 'ByronotionCoverResolver/1.0 (contact@byronotion.com)'
      },
      timeout: 5000
    });
    
    if (searchRes.data?.query?.search?.length > 0) {
      const bestMatch = searchRes.data.query.search[0];
      const exactTitle = bestMatch.title;
      
      const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(exactTitle.replace(/ /g, '_'))}`;
      const articleRes = await axios.get(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        },
        timeout: 6000
      });
      
      const html = articleRes.data;
      const infoboxMatch = html.match(/<table class="infobox[^>]*>([\s\S]*?)<\/table>/);
      if (infoboxMatch) {
        const infoboxHtml = infoboxMatch[1];
        const imgMatch = infoboxHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/);
        if (imgMatch) {
          let thumbUrl = imgMatch[1];
          if (thumbUrl.startsWith('//')) {
            thumbUrl = 'https:' + thumbUrl;
          }
          
          let fullResUrl = thumbUrl;
          if (thumbUrl.includes('/wikipedia/en/thumb/') || thumbUrl.includes('/wikipedia/commons/thumb/')) {
            let temp = thumbUrl.replace('/thumb/', '/');
            const lastSlashIdx = temp.lastIndexOf('/');
            if (lastSlashIdx !== -1) {
              fullResUrl = temp.substring(0, lastSlashIdx);
            }
          }
          return fullResUrl;
        }
      }
    }
  } catch (err) {
    // Fail silently
  }
  return '';
}

// Tests if an image URL is alive via HTTP HEAD request
async function isUrlAlive(url) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const res = await axios.head(url, {
      timeout: 3000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    return res.status === 200;
  } catch (err) {
    return false;
  }
}

// Notion page update with automatic retries for rate limits (429)
async function updatePageWithRetry(pageId, pageParams, retries = 5, delayMs = 3000) {
  try {
    return await notion.pages.update({ page_id: pageId, ...pageParams });
  } catch (error) {
    if ((error.status === 429 || error.message.includes('429') || error.message.toLowerCase().includes('rate')) && retries > 0) {
      console.warn(`\x1b[33m  [Notion Rate Limit] Waiting ${delayMs}ms before retrying page update (Retries left: ${retries})...\x1b[0m`);
      await sleep(delayMs);
      return updatePageWithRetry(pageId, pageParams, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

// Process a single database
async function repairDatabase(dbId, isMovie = true) {
  const dbName = isMovie ? 'Movies' : 'TV Series';
  console.log(`\n====================================================`);
  console.log(`🛠️  SCANNING ${dbName.toUpperCase()} DATABASE`);
  console.log(`====================================================`);

  let processedCount = 0;
  let missingCoverCount = 0;
  let repairedCount = 0;
  
  let hasMore = true;
  let startCursor = undefined;
  
  const deepCheck = process.argv.includes('--deep');
  if (deepCheck) {
    console.log('🔍 Deep Check Mode enabled: will perform live HTTP checks on existing covers.');
  } else {
    console.log('⚡ Fast Check Mode: repairing only empty covers.');
  }

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: dbId,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        processedCount++;
        let title = '';
        
        // Get Title
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            title = prop.title[0].plain_text;
            break;
          }
        }
        
        if (!title) continue;
        const decodedTitle = decodeHtmlEntities(title);
        
        const cover = page.cover;
        const coverUrl = cover && cover.external ? cover.external.url : '';
        
        let needsRepair = false;
        if (!coverUrl) {
          needsRepair = true;
        } else if (deepCheck) {
          // Verify URL is live
          const alive = await isUrlAlive(coverUrl);
          if (!alive) {
            needsRepair = true;
            console.log(`  [Broken Cover Link] "${decodedTitle}" (URL: ${coverUrl})`);
          }
        }

        if (needsRepair) {
          missingCoverCount++;
          console.log(`[#${missingCoverCount}] Missing cover detected for: "${decodedTitle}"`);
          
          let resolvedCover = '';
          
          // 1. Try primary source (OMDb for movies, TVMaze for series)
          if (isMovie) {
            console.log(`  -> Searching OMDb...`);
            resolvedCover = await getOmdbCover(decodedTitle, true);
            if (!resolvedCover) {
              console.log(`  -> Searching TVMaze...`);
              resolvedCover = await getTvMazeCover(decodedTitle);
            }
          } else {
            console.log(`  -> Searching TVMaze...`);
            resolvedCover = await getTvMazeCover(decodedTitle);
            if (!resolvedCover) {
              console.log(`  -> Searching OMDb...`);
              resolvedCover = await getOmdbCover(decodedTitle, false);
            }
          }
          
          // 2. Wikipedia HTML scraper fallback
          if (!resolvedCover) {
            console.log(`  -> Searching Wikipedia Infobox...`);
            resolvedCover = await resolveWikipediaCoverHTML(decodedTitle, isMovie);
          }
          
          if (resolvedCover) {
            console.log(`  -> \x1b[32m✔ Resolved high-res cover:\x1b[0m ${resolvedCover}`);
            
            try {
              await updatePageWithRetry(page.id, {
                cover: {
                  type: 'external',
                  external: { url: resolvedCover }
                }
              });
              repairedCount++;
              console.log(`  -> \x1b[32m✔ Notion card successfully updated!\x1b[0m`);
            } catch (err) {
              console.error(`  -> ✘ Update failed:`, err.message);
            }
          } else {
            console.log(`  -> \x1b[31m⚠️  Failed to resolve cover. Skipping.\x1b[0m`);
          }
          
          // Notion rate-limit throttle delay
          await sleep(350);
        }
      }
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
    
    console.log(`\n🎉 ${dbName} database scan completed!`);
    console.log(`🟢 Total checked: ${processedCount}`);
    console.log(`🔴 Missing/Broken covers found: ${missingCoverCount}`);
    console.log(`🟢 Successfully repaired: ${repairedCount}`);
    
  } catch (err) {
    console.error(`Critical error scanning ${dbName} database:`, err.message);
  }
}

// Master execution
async function run() {
  console.log('====================================================');
  console.log('🚀 MASTER MOVIE & SERIES COVER REPAIR SWEEP');
  console.log('====================================================');
  
  // 1. Repair Movie Database
  await repairDatabase(MOVIE_DB_ID, true);
  
  // 2. Repair Series Database
  await repairDatabase(TV_DB_ID, false);
  
  console.log('\n====================================================');
  console.log('🎉 ALL COVER REPAIRS COMPLETE!');
  console.log('====================================================\n');
}

run();
