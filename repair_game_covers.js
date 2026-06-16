/**
 * Retroactive Cover Repair Sweep for Games Database
 * Scans the Games database for items with missing covers, resolves them keylessly via Wikipedia HTML infobox upscaling, and updates Notion cards.
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf19d0815bb5d3d51ed587a7d1';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Dynamic Wikipedia HTML search -> Infobox cover extraction & upscaling (Keyless)
async function resolveWikipediaCoverHTML(title) {
  try {
    // Strip parenthetical year tags like (2004) or system tags to maximize matching accuracy
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
    // Fail silently and return empty
  }
  return '';
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

// Master repair sequence
async function runRepair() {
  console.log('====================================================');
  console.log('🛠️  STARTING GAMES MASTER COVER REPAIR SWEEP');
  console.log('====================================================\n');
  
  console.log('Step 1: Connecting to Notion & fetching games missing covers...');
  let missingCoverPages = [];
  let hasMore = true;
  let startCursor = undefined;
  
  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100,
        filter: {
          property: 'Cover',
          files: {
            is_empty: true
          }
        }
      });
      
      missingCoverPages = missingCoverPages.concat(response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
    
    console.log(`\x1b[32m✔ Loaded ${missingCoverPages.length} games currently missing cover art from Notion.\x1b[0m\n`);
    
    if (missingCoverPages.length === 0) {
      console.log('🎉 No games require cover repairs! Exiting.');
      return;
    }
    
    console.log('Step 2: Executing cover resolution and updating cards...');
    let repairedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < missingCoverPages.length; i++) {
      const page = missingCoverPages[i];
      let title = '';
      
      // Get title
      for (const key of Object.keys(page.properties)) {
        const prop = page.properties[key];
        if (prop.type === 'title' && prop.title && prop.title.length > 0) {
          title = prop.title[0].plain_text;
          break;
        }
      }
      
      console.log(`[${i + 1}/${missingCoverPages.length}] Auditing: "${title}"...`);
      
      const coverUrl = await resolveWikipediaCoverHTML(title);
      
      if (coverUrl) {
        // Build properties update
        const properties = {
          'Cover': {
            files: [{ name: 'Cover Image', type: 'external', external: { url: coverUrl } }]
          }
        };
        
        const updateParams = {
          properties: properties,
          cover: { type: 'external', external: { url: coverUrl } }
        };
        
        try {
          await updatePageWithRetry(page.id, updateParams);
          repairedCount++;
          console.log(`  -> \x1b[32m✔ Repaired successfully! URL: ${coverUrl}\x1b[0m`);
        } catch (err) {
          console.error(`  -> ✘ Update failed:`, err.message);
          failedCount++;
        }
      } else {
        console.log(`  -> ⚠️  Wikipedia yielded no box art. Skipping.`);
        failedCount++;
      }
      
      // Steady rate-limit throttle delay
      await sleep(350);
    }
    
    console.log('\n====================================================');
    console.log(`🎉 GAMES REPAIR SWEEP COMPLETE!`);
    console.log(`Repaired: ${repairedCount} covers successfully.`);
    console.log(`Failed/Unresolved: ${failedCount} games.`);
    console.log('====================================================\n');
    
  } catch (err) {
    console.error('Critical error in repair sweep:', err.message);
  }
}

runRepair();
