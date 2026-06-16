/**
 * Seeder for Games Library - 10,000 Entries Scale-up
 * Powered by keyless Metacritic reviews dataset CSV & Steam CDN / CheapShark cover lookups
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf19d0815bb5d3d51ed587a7d1';
const CSV_URL = 'https://raw.githubusercontent.com/StadynR/metacritic-reviews-dataset/master/metacritic_dataset_clean.csv';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Unescapes HTML entity characters commonly found in scraped datasets
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

// Cleans stringified arrays like "['Nintendo', 'Gradiente']" into human-readable strings like "Nintendo, Gradiente"
function cleanArrayString(str) {
  if (!str) return '';
  const trimmed = str.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const replaced = trimmed.replace(/'/g, '"');
      const parsed = JSON.parse(replaced);
      return Array.isArray(parsed) ? parsed.join(', ') : trimmed;
    } catch (e) {
      return trimmed.replace(/[\[\]']/g, '').trim();
    }
  }
  return trimmed;
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

// Parse CSV content into records
function parseCSV(csvContent) {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.trim());
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
      obj[h] = unescapeHtml(val);
    });
    records.push(obj);
  }
  return records;
}

// Dynamic Wikipedia HTML search -> Infobox cover extraction & upscaling (Keyless Fallback)
async function resolveWikipediaCoverHTML(title) {
  try {
    const cleanTitle = title.replace(/\([^)]+\)/g, '').trim();
    const searchUrl = `https://en.wikipedia.org/w/api.php`;
    const searchRes = await axios.get(searchUrl, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: `${cleanTitle} video game`,
        format: 'json',
        utf8: 1
      },
      headers: {
        'User-Agent': 'ByronotionGameCoverResolver/1.0 (contact@byronotion.com)'
      },
      timeout: 8000
    });
    
    if (searchRes.data?.query?.search?.length > 0) {
      const bestMatch = searchRes.data.query.search[0];
      const exactTitle = bestMatch.title;
      
      const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(exactTitle.replace(/ /g, '_'))}`;
      const articleRes = await axios.get(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        },
        timeout: 10000
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
    // Fail silently and return empty string
  }
  return '';
}

// Dynamic CheapShark search -> Steam CDN cover resolution (Keyless) with Wikipedia fallback
async function resolveGameCover(title) {
  try {
    const cleanTitle = title.replace(/:/g, '').replace(/ - /g, ' ').trim();
    const searchUrl = `https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(cleanTitle)}`;
    const res = await axios.get(searchUrl, { timeout: 10000 });
    
    if (res.data && res.data.length > 0) {
      const bestMatch = res.data.find(item => item.steamAppID && item.steamAppID !== 'null') || res.data[0];
      const appId = bestMatch.steamAppID;
      
      if (appId) {
        const coverUrl = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
        try {
          await axios.head(coverUrl, { timeout: 4000 });
          return coverUrl;
        } catch (e) {
          // If Steam cover check fails, proceed to Wikipedia fallback
        }
      }
    }
  } catch (err) {
    // Ignore and proceed to Wikipedia fallback
  }
  
  // Fallback to Wikipedia HTML box art
  return await resolveWikipediaCoverHTML(title);
}

// Fetch existing items to build cache of titles and prevent duplicates
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
    console.log(`\x1b[32mCache built successfully! Loaded ${cache.size} existing game items from Notion.\x1b[0m\n`);
    return cache;
  } catch (error) {
    console.error('\x1b[31mError querying Notion database:\x1b[0m', error.message);
    throw error;
  }
}

// Helper: Notion page creation with automatic retries for rate limits (429)
async function createPageWithRetry(pageParams, retries = 5, delayMs = 3000) {
  try {
    return await notion.pages.create(pageParams);
  } catch (error) {
    if ((error.status === 429 || error.message.includes('429') || error.message.toLowerCase().includes('rate')) && retries > 0) {
      console.warn(`\x1b[33m  [Notion Rate Limit] Waiting ${delayMs}ms before retrying page creation (Retries left: ${retries})...\x1b[0m`);
      await sleep(delayMs);
      return createPageWithRetry(pageParams, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

// Master execution pipeline
async function start() {
  const isDryRun = process.argv.includes('--dry-run');
  const limit = 10000;
  
  console.log('====================================================');
  console.log(`🚀 GAMES 10K MASTER SEEDING PIPELINE STARTING ${isDryRun ? '(DRY RUN)' : ''}`);
  console.log('====================================================\n');
  
  console.log('Step 1: Downloading Metacritic games dataset...');
  let csvContent = '';
  try {
    const res = await axios.get(CSV_URL, { timeout: 20000 });
    csvContent = res.data;
    console.log(`✔ Downloaded Metacritic CSV file successfully.`);
  } catch (err) {
    console.error('Error downloading games CSV:', err.message);
    process.exit(1);
  }
  
  console.log('\nStep 2: Parsing CSV rows...');
  const rawRecords = parseCSV(csvContent);
  console.log(`✔ Parsed ${rawRecords.length} raw game records.`);
  
  console.log('\nStep 3: Grouping multiplatform entries and deduplicating...');
  const gamesMap = new Map();
  
  for (const record of rawRecords) {
    const titleKey = record.name.toLowerCase().trim();
    
    // Parse values
    const metascore = parseInt(record.metascore, 10) || null;
    let userScore = parseFloat(record.user_score);
    if (isNaN(userScore)) userScore = null;
    
    let year = null;
    if (record.release_date) {
      const parts = record.release_date.split('-');
      if (parts[0]) year = parseInt(parts[0], 10);
    }
    
    const platform = record.platform || '';
    const genre = record.genre || '';
    const developer = cleanArrayString(record.developer);
    const publisher = cleanArrayString(record.publisher);
    
    if (gamesMap.has(titleKey)) {
      const existing = gamesMap.get(titleKey);
      
      // Update values with best specs
      if (platform) existing.platforms.add(platform);
      if (genre) existing.genres.add(genre);
      
      if (metascore !== null && (existing.metascore === null || metascore > existing.metascore)) {
        existing.metascore = metascore;
      }
      if (userScore !== null && (existing.userScore === null || userScore > existing.userScore)) {
        existing.userScore = userScore;
      }
      if (year !== null && (existing.year === null || year < existing.year)) {
        // Keep oldest year for original release year representation
        existing.year = year;
      }
      if (developer && !existing.developer.includes(developer)) {
        existing.developer = existing.developer ? `${existing.developer}, ${developer}` : developer;
      }
      if (publisher && !existing.publisher.includes(publisher)) {
        existing.publisher = existing.publisher ? `${existing.publisher}, ${publisher}` : publisher;
      }
    } else {
      gamesMap.set(titleKey, {
        title: record.name,
        platforms: new Set(platform ? [platform] : []),
        genres: new Set(genre ? [genre] : []),
        metascore: metascore,
        userScore: userScore,
        year: year,
        developer: developer,
        publisher: publisher
      });
    }
  }
  
  console.log(`✔ Grouped into ${gamesMap.size} unique titles.`);
  
  console.log('\nStep 4: Sorting by Metascore descending & selecting top 10,000 unique games...');
  let sortedGames = Array.from(gamesMap.values()).sort((a, b) => {
    const scoreA = a.metascore || 0;
    const scoreB = b.metascore || 0;
    return scoreB - scoreA;
  });
  
  const finalSet = sortedGames.slice(0, limit);
  console.log(`✔ Selected the top ${finalSet.length} games (Metascore range: ${finalSet[0]?.metascore || 0} down to ${finalSet[finalSet.length - 1]?.metascore || 0}).`);
  
  if (isDryRun) {
    console.log('\n====================================================');
    console.log('⭐ DRY RUN STATS & PREVIEWS:');
    console.log('====================================================');
    console.log(`First Game: "${finalSet[0].title}" [Platforms: ${Array.from(finalSet[0].platforms).join(', ')}] [Score: ${finalSet[0].metascore}] [Year: ${finalSet[0].year}]`);
    console.log(`Second Game: "${finalSet[1].title}" [Platforms: ${Array.from(finalSet[1].platforms).join(', ')}] [Score: ${finalSet[1].metascore}] [Year: ${finalSet[1].year}]`);
    console.log(`Last Selected: "${finalSet[finalSet.length - 1].title}" [Platforms: ${Array.from(finalSet[finalSet.length - 1].platforms).join(', ')}] [Score: ${finalSet[finalSet.length - 1].metascore}]`);
    
    console.log('\nDry run completed successfully. No Notion writes were made.');
    return;
  }
  
  // Notion Integration Live Mode
  console.log('\nStep 5: Connecting to Notion & building existing titles cache...');
  const cache = await fetchNotionCache();
  
  console.log('\nStep 6: Executing rate-limited insertions...');
  let inserted = 0;
  let skipped = 0;
  
  for (let i = 0; i < finalSet.length; i++) {
    const game = finalSet[i];
    const cacheKey = game.title.toLowerCase().trim();
    
    if (cache.has(cacheKey)) {
      skipped++;
      continue;
    }
    
    console.log(`[${i + 1}/${finalSet.length}] Seeding Game: "${game.title}"...`);
    
    // Resolve Cover Art
    const coverUrl = await resolveGameCover(game.title);
    
    // Build Synopsis
    const devStr = game.developer ? ` developed by ${game.developer}` : '';
    const pubStr = game.publisher ? ` and published by ${game.publisher}` : '';
    const platformListStr = game.platforms.size > 0 ? ` on ${Array.from(game.platforms).join(', ')}` : '';
    const genresListStr = game.genres.size > 0 ? ` (${Array.from(game.genres).join(', ')})` : '';
    const synopsis = `A critically acclaimed video game${genresListStr}${devStr}${pubStr}, originally released in ${game.year || 'unknown'}${platformListStr}. Ranked among the greatest games of all time with a Metascore of ${game.metascore || 'N/A'}.`;
    
    // Properties object
    const properties = {
      'Title': {
        title: [{ text: { content: game.title } }]
      },
      'Status': {
        select: { name: 'Inbox' }
      },
      'Synopsis': {
        rich_text: [{ text: { content: synopsis.substring(0, 1900) } }]
      }
    };
    
    if (game.developer) {
      properties['Developer'] = { rich_text: [{ text: { content: game.developer.substring(0, 1900) } }] };
    }
    if (game.publisher) {
      properties['Publisher'] = { rich_text: [{ text: { content: game.publisher.substring(0, 1900) } }] };
    }
    
    if (game.metascore !== null) {
      properties['Metacritic'] = { number: game.metascore };
    }
    
    if (game.userScore !== null) {
      properties['UserScore'] = { number: game.userScore };
    }
    
    if (game.year !== null) {
      properties['ReleaseYear'] = { number: game.year };
    }
    
    if (game.platforms.size > 0) {
      properties['Platform'] = {
        multi_select: Array.from(game.platforms).map(p => ({ name: p.substring(0, 100) }))
      };
    }
    
    if (game.genres.size > 0) {
      properties['Genre'] = {
        multi_select: Array.from(game.genres).map(g => ({ name: g.substring(0, 100) }))
      };
    }
    
    if (coverUrl) {
      properties['Cover'] = {
        files: [{ name: 'Cover Image', type: 'external', external: { url: coverUrl } }]
      };
    }
    
    const pageParams = {
      parent: { database_id: DATABASE_ID },
      properties: properties
    };
    
    if (coverUrl) {
      pageParams.cover = { type: 'external', external: { url: coverUrl } };
    }
    
    try {
      await createPageWithRetry(pageParams);
      inserted++;
      console.log(`  -> \x1b[32m✔ Successfully Seeded! (Cover: ${coverUrl ? 'Resolved' : 'None'})\x1b[0m`);
    } catch (e) {
      console.error(`  -> \x1b[31m✘ Failed to insert:\x1b[0m`, e.message);
      if (e.body) console.error('  Details:', e.body);
    }
    
    // Strict Notion rate-limiting throttle (approx 3 write requests/sec)
    await sleep(350);
  }
  
  console.log('\n====================================================');
  console.log(`🎉 PIPELINE COMPLETE!`);
  console.log(`Seeded: ${inserted} games successfully.`);
  console.log(`Skipped: ${skipped} games (already in cache).`);
  console.log('====================================================');
}

start();
