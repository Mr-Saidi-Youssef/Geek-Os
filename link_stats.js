/**
 * Robust Linker Script using Database Relation Metadata
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error('\x1b[31mError: Credentials missing in .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function startLinking() {
  console.log('====================================================');
  console.log('🚀 Executing Robust Relation Linker...');
  console.log('====================================================\n');

  try {
    // 1. Retrieve the Anime Watchlist Database properties to find the relation and the related DB ID
    console.log('Retrieving Anime Watchlist Database schema...');
    const db = await notion.databases.retrieve({ database_id: DATABASE_ID });
    
    let relationPropName = '';
    let statsDbId = '';

    for (const [propName, propConfig] of Object.entries(db.properties)) {
      if (propConfig.type === 'relation') {
        relationPropName = propName;
        statsDbId = propConfig.relation.database_id;
        console.log(`\x1b[32m✔ Found Relation Property: "${propName}"\x1b[0m`);
        console.log(`  Related Database ID: ${statsDbId}\n`);
        break;
      }
    }

    if (!relationPropName || !statsDbId) {
      console.error('\x1b[31mError: Could not find a Relation column in your database schema.\x1b[0m');
      console.log('Please ensure you have created a Relation property connecting your Anime Watchlist to your Stats Engine database.');
      return;
    }

    // 2. Query the Stats Engine database directly to find the page named "All-Time Stats"
    console.log(`Querying Stats Engine database (${statsDbId}) for "All-Time Stats"...`);
    const statsQuery = await notion.databases.query({
      database_id: statsDbId,
      page_size: 10
    });

    let statsPageId = '';
    for (const page of statsQuery.results) {
      // Look for the title property
      const titleKey = Object.keys(page.properties).find(k => page.properties[k].type === 'title');
      const titleText = page.properties[titleKey]?.title[0]?.plain_text || '';
      
      if (titleText.trim() === 'All-Time Stats') {
        statsPageId = page.id;
        break;
      }
    }

    if (!statsPageId) {
      console.error('\x1b[31mError: Could not find the row "All-Time Stats" inside the Stats Engine database.\x1b[0m');
      console.log('Please ensure your Stats Engine database has a row named exactly "All-Time Stats".');
      return;
    }

    console.log(`\x1b[32m✔ Found target "All-Time Stats" page! ID: ${statsPageId}\x1b[0m\n`);

    // 3. Query all pages in the Anime database
    console.log('Querying all anime pages from master list...');
    let allPages = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100
      });
      allPages = allPages.concat(response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`Found ${allPages.length} anime pages to update.\n`);

    // 4. Update the relation property for every page
    let successCount = 0;
    for (const page of allPages) {
      const pageTitle = page.properties['Title']?.title[0]?.plain_text || 'Untitled';
      
      // Check if already linked
      const currentRelation = page.properties[relationPropName]?.relation || [];
      const isAlreadyLinked = currentRelation.some(rel => rel.id === statsPageId);

      if (isAlreadyLinked) {
        console.log(`\x1b[90m[Already Linked] "${pageTitle}"\x1b[0m`);
        successCount++;
        continue;
      }

      console.log(`[Linking] "${pageTitle}" -> "All-Time Stats"...`);
      try {
        await notion.pages.update({
          page_id: page.id,
          properties: {
            [relationPropName]: {
              relation: [
                {
                  id: statsPageId
                }
              ]
            }
          }
        });
        successCount++;
        // 350ms delay to satisfy Notion API limits safely
        await new Promise(resolve => setTimeout(resolve, 350));
      } catch (err) {
        console.error(`\x1b[31m  Failed to link "${pageTitle}":\x1b[0m`, err.message);
      }
    }

    console.log('\n====================================================');
    console.log('\x1b[32m🎉 Linking execution completed successfully!\x1b[0m');
    console.log(`🔗 Successfully Linked: ${successCount} / ${allPages.length} pages.`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('\x1b[31mCritical error during execution:\x1b[0m', error.message);
    console.log('\n💡 Troubleshooting checklist:');
    console.log('  1. Open your main database: https://www.notion.so/36dd0aaf19d0800792e7dca0434c570c');
    console.log('  2. Click the "..." button in the top-right corner.');
    console.log('  3. Scroll to "Connect to" / "Add Connections".');
    console.log('  4. Make sure "MAL Anime Watchlist Sync" is selected and active.');
  }
}

startLinking();
