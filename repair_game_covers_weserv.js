/**
 * repair_game_covers_weserv.js
 * Scans the Notion Games database to find and repair Wikipedia covers.
 * Bypasses Wikipedia's hotlinking CDN block by wrapping them inside the free, Cloudflare-backed images.weserv.nl proxy.
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf19d0815bb5d3d51ed587a7d1';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const scanLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10000;

// Notion page updates with retry mechanics for rate limits
async function updatePageWithRetry(pageId, pageParams, retries = 5, delayMs = 3000) {
  try {
    return await notion.pages.update({ page_id: pageId, ...pageParams });
  } catch (error) {
    if ((error.status === 429 || error.message.includes('429') || error.message.toLowerCase().includes('rate')) && retries > 0) {
      console.warn(`  [Notion Rate Limit] Waiting ${delayMs}ms before retrying page update (Retries left: ${retries})...`);
      await sleep(delayMs);
      return updatePageWithRetry(pageId, pageParams, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

async function run() {
  console.log('====================================================');
  console.log(`🚀 GAMES WESERV PROXY COVER REPAIR SWEEP ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);
  console.log(`   Wrapping all upload.wikimedia.org covers in images.weserv.nl`);
  console.log('====================================================\n');

  try {
    console.log('Querying Notion Games database...');
    let checkedCount = 0;
    let updatedCount = 0;
    let wikiCoversFound = 0;

    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        if (checkedCount >= scanLimit) {
          hasMore = false;
          break;
        }

        checkedCount++;
        let title = '';
        
        // Extract title
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            title = prop.title[0].plain_text;
            break;
          }
        }

        if (!title) continue;
        const cleanTitle = title.trim();
        
        // Check current Page Cover URL
        const pageCoverUrl = page.cover?.external?.url || page.cover?.file?.url || '';
        
        // Check current Cover property files column
        const coverProp = page.properties['Cover'];
        let coverPropUrl = '';
        if (coverProp && coverProp.type === 'files' && coverProp.files.length > 0) {
          const fileObj = coverProp.files[0];
          coverPropUrl = fileObj.external ? fileObj.external.url : (fileObj.file ? fileObj.file.url : '');
        }

        let needsUpdate = false;
        let originalWikiUrl = '';

        // Detect if it is a Wikipedia URL and not already proxied
        if (pageCoverUrl.includes('upload.wikimedia.org') && !pageCoverUrl.includes('images.weserv.nl')) {
          needsUpdate = true;
          originalWikiUrl = pageCoverUrl;
        } else if (coverPropUrl.includes('upload.wikimedia.org') && !coverPropUrl.includes('images.weserv.nl')) {
          needsUpdate = true;
          originalWikiUrl = coverPropUrl;
        }

        if (needsUpdate) {
          wikiCoversFound++;
          
          // Generate wrapped proxy URL
          const wrappedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(originalWikiUrl)}`;
          
          console.log(`[Wikipedia Cover Detected] "${cleanTitle}"`);
          console.log(`  Original URL: ${originalWikiUrl}`);
          console.log(`  Proxy URL:    ${wrappedUrl}`);

          if (!dryRun) {
            try {
              const updateParams = {
                cover: {
                  type: 'external',
                  external: { url: wrappedUrl }
                },
                properties: {
                  'Cover': {
                    files: [
                      {
                        name: 'Cover Image',
                        type: 'external',
                        external: { url: wrappedUrl }
                      }
                    ]
                  }
                }
              };

              await updatePageWithRetry(page.id, updateParams);
              updatedCount++;
              console.log(`  \x1b[32m✔ Successfully wrapped and updated in Notion.\x1b[0m`);
            } catch (err) {
              console.error(`  \x1b[31m✘ Failed to update Notion: ${err.message}\x1b[0m`);
            }
            await sleep(350); // respect Notion write rate limit
          } else {
            console.log(`  \x1b[33m[Dry Run] Would wrap in images.weserv.nl proxy.\x1b[0m`);
          }
        }
      }

      if (!hasMore) break;
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log('\n====================================================');
    console.log(`🎉 GAMES WESERV REPAIR SWEEP COMPLETE!`);
    console.log(`🟢 Total games scanned: ${checkedCount}`);
    console.log(`🔴 Wikipedia covers found: ${wikiCoversFound}`);
    console.log(`🟢 Total covers updated: ${updatedCount}`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Critical error in Games Weserv repair sweep:', err.message);
  }
}

run();
