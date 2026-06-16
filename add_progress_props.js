/**
 * add_progress_props.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Schema migration script to add "Chapters Read", "Issues Read", "Volumes Read",
 * and dynamic visual "Progress" formula properties to Manga and Comics databases.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MANGA_DB_ID = '370d0aaf-19d0-8121-a36f-f3dfcc914532';
const COMICS_DB_ID = '371d0aaf-19d0-81c5-9b14-fbc0c52b0040';

const notion = new Client({ auth: NOTION_TOKEN });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function updateMangaSchema() {
  console.log('🔄 Updating Manga Library schema...');
  try {
    // Step 1: Add number properties
    console.log('   Adding number properties: "Chapters Read", "Volumes Read"...');
    await notion.databases.update({
      database_id: MANGA_DB_ID,
      properties: {
        'Chapters Read': { number: { format: 'number' } },
        'Volumes Read': { number: { format: 'number' } }
      }
    });
    console.log('   ✓ Number columns added successfully.');
    await sleep(1000);

    // Step 2: Add progress formula property
    console.log('   Adding visual "Progress" formula...');
    const mangaFormula = `if(prop("Chapters") > 0, (if(prop("Chapters Read") >= prop("Chapters"), "✅", "📖") + "  " + slice("▰▰▰▰▰▰▰▰▰▰", 0, floor(min(prop("Chapters Read") / prop("Chapters"), 1) * 10)) + slice("▱▱▱▱▱▱▱▱▱▱", 0, 10 - floor(min(prop("Chapters Read") / prop("Chapters"), 1) * 10)) + "  " + format(round(min(prop("Chapters Read") / prop("Chapters"), 1) * 100)) + "%  ·  " + format(prop("Chapters Read")) + " / " + format(prop("Chapters"))), if(prop("Volumes") > 0, (if(prop("Volumes Read") >= prop("Volumes"), "✅", "📖") + "  " + slice("▰▰▰▰▰▰▰▰▰▰", 0, floor(min(prop("Volumes Read") / prop("Volumes"), 1) * 10)) + slice("▱▱▱▱▱▱▱▱▱▱", 0, 10 - floor(min(prop("Volumes Read") / prop("Volumes"), 1) * 10)) + "  " + format(round(min(prop("Volumes Read") / prop("Volumes"), 1) * 100)) + "%  ·  " + format(prop("Volumes Read")) + " / " + format(prop("Volumes"))), "📚  ▱▱▱▱▱▱▱▱▱▱"))`;
    
    await notion.databases.update({
      database_id: MANGA_DB_ID,
      properties: {
        'Progress': {
          formula: {
            expression: mangaFormula
          }
        }
      }
    });
    console.log('   ✓ "Progress" formula property deployed successfully on Manga Library.');
  } catch (err) {
    console.error('   ❌ Failed to update Manga Library schema:', err.message);
  }
}

async function updateComicsSchema() {
  console.log('\n🔄 Updating Comics Library schema...');
  try {
    // Step 1: Add number properties
    console.log('   Adding number properties: "Issues Read", "Volumes Read"...');
    await notion.databases.update({
      database_id: COMICS_DB_ID,
      properties: {
        'Issues Read': { number: { format: 'number' } },
        'Volumes Read': { number: { format: 'number' } }
      }
    });
    console.log('   ✓ Number columns added successfully.');
    await sleep(1000);

    // Step 2: Add progress formula property
    console.log('   Adding visual "Progress" formula...');
    const comicsFormula = `if(prop("Issues") > 0, (if(prop("Issues Read") >= prop("Issues"), "✅", "📖") + "  " + slice("▰▰▰▰▰▰▰▰▰▰", 0, floor(min(prop("Issues Read") / prop("Issues"), 1) * 10)) + slice("▱▱▱▱▱▱▱▱▱▱", 0, 10 - floor(min(prop("Issues Read") / prop("Issues"), 1) * 10)) + "  " + format(round(min(prop("Issues Read") / prop("Issues"), 1) * 100)) + "%  ·  " + format(prop("Issues Read")) + " / " + format(prop("Issues"))), if(prop("Volumes") > 0, (if(prop("Volumes Read") >= prop("Volumes"), "✅", "📖") + "  " + slice("▰▰▰▰▰▰▰▰▰▰", 0, floor(min(prop("Volumes Read") / prop("Volumes"), 1) * 10)) + slice("▱▱▱▱▱▱▱▱▱▱", 0, 10 - floor(min(prop("Volumes Read") / prop("Volumes"), 1) * 10)) + "  " + format(round(min(prop("Volumes Read") / prop("Volumes"), 1) * 100)) + "%  ·  " + format(prop("Volumes Read")) + " / " + format(prop("Volumes"))), "📚  ▱▱▱▱▱▱▱▱▱▱"))`;
    
    await notion.databases.update({
      database_id: COMICS_DB_ID,
      properties: {
        'Progress': {
          formula: {
            expression: comicsFormula
          }
        }
      }
    });
    console.log('   ✓ "Progress" formula property deployed successfully on Comics Library.');
  } catch (err) {
    console.error('   ❌ Failed to update Comics Library schema:', err.message);
  }
}

async function run() {
  console.log('======================================================');
  console.log('🚀 STARTING PROGRESS PROPERTIES DEPLOYMENT PIPELINE');
  console.log('======================================================\n');
  await updateMangaSchema();
  await sleep(1000);
  await updateComicsSchema();
  console.log('\n======================================================');
  console.log('🎉 SCHEMA DEPLOYMENT COMPLETE');
  console.log('======================================================\n');
}

run();
