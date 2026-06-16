const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const DB_IDS = {
  anime: '36dd0aaf19d0800792e7dca0434c570c',
  manga: '370d0aaf-19d0-8121-a36f-f3dfcc914532'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function unwrapWeservUrl(url) {
  if (!url) return null;
  if (url.includes('images.weserv.nl')) {
    try {
      // Try using URL class
      const u = new URL(url);
      const targetUrl = u.searchParams.get('url');
      if (targetUrl && targetUrl.includes('myanimelist.net')) {
        return targetUrl;
      }
    } catch (_) {
      // Fallback regex
      const match = url.match(/url=([^&]+)/);
      if (match) {
        const decoded = decodeURIComponent(match[1]);
        if (decoded.includes('myanimelist.net')) {
          return decoded;
        }
      }
    }
  }
  return null;
}

async function repairDatabase(dbKey, dbId) {
  console.log(`\n======================================================`);
  console.log(`🔍  REPAIRING DATABASE: ${dbKey.toUpperCase()} (${dbId})`);
  console.log(`======================================================`);

  let allPages = [];
  let cursor;
  
  process.stdout.write('Fetching pages...');
  do {
    try {
      const res = await notion.databases.query({
        database_id: dbId,
        start_cursor: cursor,
        page_size: 100
      });
      allPages = allPages.concat(res.results);
      cursor = res.has_more ? res.next_cursor : undefined;
      process.stdout.write(` ${allPages.length}`);
    } catch (err) {
      console.error(`\n❌ Error fetching database pages: ${err.message}`);
      return;
    }
  } while (cursor);
  console.log(` total.\n`);

  let updatedCount = 0;

  for (const page of allPages) {
    const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
    let needsUpdate = false;
    const updateParams = {
      page_id: page.id,
      properties: {}
    };

    // 1. Check page cover
    if (page.cover && page.cover.type === 'external' && page.cover.external?.url) {
      const unwrappedCover = unwrapWeservUrl(page.cover.external.url);
      if (unwrappedCover) {
        updateParams.cover = {
          type: 'external',
          external: { url: unwrappedCover }
        };
        needsUpdate = true;
        console.log(`  [Cover] "${title}": unwrapped to direct MAL URL`);
      }
    }

    // 2. Check files properties (Cover Image, Cover, etc.)
    for (const [propName, propVal] of Object.entries(page.properties)) {
      if (propVal.type === 'files' && propVal.files && propVal.files.length > 0) {
        let filesUpdated = false;
        const newFiles = propVal.files.map(file => {
          if (file.type === 'external' && file.external?.url) {
            const unwrappedFile = unwrapWeservUrl(file.external.url);
            if (unwrappedFile) {
              filesUpdated = true;
              return {
                name: file.name || 'Cover Image',
                type: 'external',
                external: { url: unwrappedFile }
              };
            }
          }
          return file;
        });

        if (filesUpdated) {
          updateParams.properties[propName] = {
            files: newFiles
          };
          needsUpdate = true;
          console.log(`  [Prop: ${propName}] "${title}": unwrapped to direct MAL URL`);
        }
      }
    }

    if (needsUpdate) {
      try {
        await notion.pages.update(updateParams);
        updatedCount++;
        // Respect Notion API rate limit (max 3 req/sec is safe)
        await sleep(350);
      } catch (err) {
        console.error(`  ❌ Error updating page "${title}" (${page.id}): ${err.message}`);
      }
    }
  }

  console.log(`\n✓ Finished repairing ${dbKey.toUpperCase()}. Updated ${updatedCount} pages.`);
}

async function run() {
  const startTime = Date.now();
  await repairDatabase('anime', DB_IDS.anime);
  await repairDatabase('manga', DB_IDS.manga);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉  ALL REPAIRS COMPLETED in ${duration}s!`);
}

run().catch(err => console.error('Fatal error in runner:', err.message));
