/**
 * deploy_fallback_covers.js
 * Scans the Notion Movies and TV Series databases for empty covers,
 * and automatically applies a premium vertical cinematic abstract cover.
 * Ensures zero empty/grey cards in Notion Gallery layouts!
 * Includes robust 429 rate-limit handling and throttling.
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MOVIE_DB_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const TV_DB_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';

// Premium dark fluid abstract poster URL
const FALLBACK_COVER_URL = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not configured.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Robust Notion query with automatic retries for rate limits (429)
async function queryDatabaseWithRetry(queryPayload, retries = 5, delayMs = 3000) {
  try {
    return await notion.databases.query(queryPayload);
  } catch (error) {
    if ((error.status === 429 || error.message.includes('429') || error.message.toLowerCase().includes('rate')) && retries > 0) {
      console.warn(`\n⚠️  [Notion Rate Limit] Waiting ${delayMs}ms before retrying query (Retries left: ${retries})...`);
      await sleep(delayMs);
      return queryDatabaseWithRetry(queryPayload, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

// Robust Notion page update with automatic retries for rate limits (429)
async function updatePageWithRetry(pageId, pageParams, retries = 5, delayMs = 3000) {
  try {
    return await notion.pages.update({ page_id: pageId, ...pageParams });
  } catch (error) {
    if ((error.status === 429 || error.message.includes('429') || error.message.toLowerCase().includes('rate')) && retries > 0) {
      console.warn(`\n⚠️  [Notion Rate Limit] Waiting ${delayMs}ms before retrying update (Retries left: ${retries})...`);
      await sleep(delayMs);
      return updatePageWithRetry(pageId, pageParams, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

async function deployFallbacksForDatabase(dbId, dbName) {
  console.log(`\n====================================================`);
  console.log(`🛠️  APPLYING FALLBACK COVERS IN ${dbName.toUpperCase()}`);
  console.log(`====================================================`);

  let scannedCount = 0;
  let repairedCount = 0;
  let hasMore = true;
  let startCursor = undefined;
  let batchNum = 0;

  try {
    while (hasMore) {
      batchNum++;
      console.log(`📡 Querying ${dbName} batch #${batchNum}...`);
      
      const response = await queryDatabaseWithRetry({
        database_id: dbId,
        start_cursor: startCursor,
        page_size: 100
      });

      for (const page of response.results) {
        scannedCount++;
        
        let title = '';
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            title = prop.title[0].plain_text;
            break;
          }
        }

        const cover = page.cover;
        const coverUrl = cover && cover.external ? cover.external.url : '';

        // Check if cover is empty or is a low-res placeholder
        let needsFallback = !coverUrl;
        if (coverUrl) {
          const url = coverUrl.toLowerCase();
          if (url.includes('nophoto') || url.includes('placeholder') || url.includes('nocover') || url.includes('111x148')) {
            needsFallback = true;
          }
        }

        if (needsFallback) {
          repairedCount++;
          console.log(`  [#${repairedCount}] Applying premium fallback cover for: "${title || 'Unnamed Item'}"`);
          
          try {
            await updatePageWithRetry(page.id, {
              cover: {
                type: 'external',
                external: { url: FALLBACK_COVER_URL }
              }
            });
            console.log(`    -> ✔ Notion page cover updated!`);
          } catch (err) {
            console.error(`    -> ❌ Failed to update page cover: ${err.message}`);
          }
          
          // Throttling delay after updating a page to respect Notion API limits
          await sleep(350);
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor;
      
      // Enforce steady sleep between query batches to prevent rate limits
      await sleep(350);
    }

    console.log(`\n🎉 ${dbName} database fallback sweep complete!`);
    console.log(`🟢 Scanned pages: ${scannedCount}`);
    console.log(`🟢 Applied fallbacks: ${repairedCount}`);

  } catch (err) {
    console.error(`Critical error sweeping ${dbName}:`, err.message);
  }
}

async function run() {
  console.log('====================================================');
  console.log('🚀 DEPLOYING PREMIUM CINEMATIC FALLBACK COVERS');
  console.log('====================================================');

  // 1. Run for TV Series
  await deployFallbacksForDatabase(TV_DB_ID, 'TV Series');

  // 2. Run for Movies
  await deployFallbacksForDatabase(MOVIE_DB_ID, 'Movies');

  console.log('\n====================================================');
  console.log('🎉 ALL FALLBACK DEPLOYMENTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');
}

run();
