const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MANGA_DB_ID = '370d0aaf-19d0-8121-a36f-f3dfcc914532';
const ANIME_DB_ID = '36dd0aaf-19d0-8007-92e7-dca0434c570c';
const CONCURRENT_LIMIT = 6;

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not configured in .env');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry(fn, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err.status === 429 || err.code === 'rate_limited';
      if (is429 && attempt < retries) {
        const delay = (attempt + 1) * 3000 + 2000;
        console.log(`⏳ Rate limited. Waiting ${delay}ms before retrying...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

function getPageTitle(page) {
  for (const [, v] of Object.entries(page.properties)) {
    if (v.type === 'title') return v.title.map(t => t.plain_text).join('').trim();
  }
  return '(Untitled)';
}

async function purgeDatabase(dbId, dbName) {
  console.log(`\n🔍 Scanning "${dbName}" for pages tagged with "Hentai"...`);
  let matchingPages = [];
  let cursor;

  try {
    do {
      const res = await withRetry(() => notion.databases.query({
        database_id: dbId,
        start_cursor: cursor,
        page_size: 100,
        filter: {
          property: 'Genres',
          multi_select: {
            contains: 'Hentai'
          }
        }
      }));
      matchingPages = matchingPages.concat(res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
      await sleep(350);
    } while (cursor);

    console.log(`Found ${matchingPages.length} mature pages in "${dbName}".`);

    let currentIndex = 0;
    async function worker() {
      while (currentIndex < matchingPages.length) {
        const page = matchingPages[currentIndex++];
        if (!page) break;
        
        const title = getPageTitle(page);
        try {
          await withRetry(() => notion.pages.update({
            page_id: page.id,
            archived: true
          }));
          console.log(`   [✓] Archived: "${title}"`);
        } catch (err) {
          console.log(`   [❌] Failed to archive "${title}": ${err.message}`);
        }
        await sleep(350); // Pause between requests per worker to respect rate limits
      }
    }

    // Start parallel workers
    await Promise.all(Array.from({ length: CONCURRENT_LIMIT }, () => worker()));
    
    console.log(`✓ Completed purge for "${dbName}".`);
  } catch (err) {
    console.error(`❌ Failed to purge "${dbName}":`, err.message);
  }
}

async function run() {
  console.log('======================================================');
  console.log('🌸 STARTING ROBUST WORKER-POOL MATURE PURGE PIPELINE');
  console.log('======================================================\n');

  await purgeDatabase(ANIME_DB_ID, 'Anime Watchlist');
  await sleep(1000);
  await purgeDatabase(MANGA_DB_ID, 'Manga Library');

  console.log('\n======================================================');
  console.log('🎉 PURGE PIPELINE COMPLETE');
  console.log('======================================================\n');
}

run();
