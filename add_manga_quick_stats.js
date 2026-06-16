/**
 * add_manga_quick_stats.js
 * Automatically deploys the custom "Quick Stats" Notion 2.0 formula to the Manga Library database.
 * Displays: ⭐ MAL Score   📚 Volumes vols   📄 Chapters chs
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MANGA_DB_ID  = process.env.NOTION_MANGA_DATABASE_ID || '370d0aaf19d08121a36ff3dfcc914532';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not configured in .env\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

const MANGA_FORMULA = `
if(
  prop("MAL Score") > 0,
  "⭐ " + format(prop("MAL Score")),
  ""
) +
if(
  prop("Volumes") > 0,
  "  📚 " + format(prop("Volumes")) + " vols",
  ""
) +
if(
  prop("Chapters") > 0,
  "  📄 " + format(prop("Chapters")) + " chs",
  ""
)
`.trim();

async function updateFormula() {
  console.log(`\n📝 Deploying "Quick Stats" formula to Manga Library database...`);
  try {
    await notion.databases.update({
      database_id: MANGA_DB_ID,
      properties: {
        'Quick Stats': {
          formula: {
            expression: MANGA_FORMULA
          }
        }
      }
    });
    console.log(`  \x1b[32m✅ "Quick Stats" formula deployed successfully to Manga Library!\x1b[0m`);
  } catch (err) {
    console.error(`  \x1b[31m❌ Failed to update Manga Library database:\x1b[0m`, err.message);
    if (err.body) console.error('  Details:', err.body);
  }
}

updateFormula();
