/**
 * repair_comic_covers_weserv.js
 * Scans the Notion Comics database to find and repair missing/broken cover images.
 * Bypasses Amazon S3/Goodreads/OpenLibrary hotlinking blocks by wrapping cover URLs in the free, Cloudflare-backed images.weserv.nl proxy.
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_COMICS_DATABASE_ID || '371d0aaf19d081c59b14fbc0c52b0040';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dryRun = process.argv.includes('--dry-run');

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
  console.log(`🚀 COMICS WESERV PROXY COVER REPAIR SWEEP ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);
  console.log(`   Wrapping all cover URLs in images.weserv.nl to bypass hotlinking blocks`);
  console.log('====================================================\n');

  try {
    console.log('Querying Notion Comics database...');
    let checkedCount = 0;
    let updatedCount = 0;
    let coversRepaired = 0;

    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        checkedCount++;
        let title = '';
        
        // Extract title
        const titleProp = page.properties['Title'];
        if (titleProp && titleProp.type === 'title' && titleProp.title.length > 0) {
          title = titleProp.title[0].plain_text;
        }

        if (!title || title === 'New Comics') continue;
        const cleanTitle = title.trim();
        
        // Check current Page Cover URL
        const pageCoverUrl = page.cover?.external?.url || page.cover?.file?.url || '';
        
        // Check current Cover Image property files column
        const coverProp = page.properties['Cover Image'];
        let coverPropUrl = '';
        if (coverProp && coverProp.type === 'files' && coverProp.files.length > 0) {
          const fileObj = coverProp.files[0];
          coverPropUrl = fileObj.external ? fileObj.external.url : (fileObj.file ? fileObj.file.url : '');
        }

        let needsUpdate = false;
        let originalUrl = '';

        // Target Goodreads, OpenLibrary, and Amazon covers that are not already proxied
        if (pageCoverUrl && !pageCoverUrl.includes('images.weserv.nl')) {
          needsUpdate = true;
          originalUrl = pageCoverUrl;
        } else if (coverPropUrl && !coverPropUrl.includes('images.weserv.nl')) {
          needsUpdate = true;
          originalUrl = coverPropUrl;
        }

        if (needsUpdate && originalUrl) {
          coversRepaired++;
          
          // Generate wrapped proxy URL
          const wrappedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl)}`;
          
          console.log(`[Cover Needs Proxy] "${cleanTitle}"`);
          console.log(`  Original URL: ${originalUrl}`);
          console.log(`  Proxy URL:    ${wrappedUrl}`);

          if (!dryRun) {
            try {
              const updateParams = {
                cover: {
                  type: 'external',
                  external: { url: wrappedUrl }
                },
                properties: {
                  'Cover Image': {
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
              console.log(`  \x1b[32m✔ Successfully updated cover inside Notion.\x1b[0m`);
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
    console.log(`🎉 COMICS WESERV REPAIR SWEEP COMPLETE!`);
    console.log(`🟢 Total comics scanned: ${checkedCount}`);
    console.log(`🔴 Broken/Blocked covers found: ${coversRepaired}`);
    console.log(`🟢 Total covers updated: ${updatedCount}`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Critical error in Comics Weserv repair sweep:', err.message);
  }
}

run();
