/**
 * add_quick_stats.js
 * Automatically deploys custom "Quick Stats" Notion 2.0 formulas to:
 * 1. Games Database (Metacritic, User Score, Release Year, Status)
 * 2. Books Database (Community Rating, Total Pages, Type, Status)
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const GAMES_DB_ID  = process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf19d0815bb5d3d51ed587a7d1';
const BOOKS_DB_ID  = '8b2780bfd84442d8bcd95223152c0ece';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not configured in .env\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

// ─── Games Formula ──────────────────────────────────────────────────────────
// Shows: 🏆 98  ⭐ 9.2  📅 2011
const GAMES_FORMULA = `
if(
  prop("Metacritic") > 0,
  "🏆 " + format(prop("Metacritic")),
  ""
) +
if(
  prop("UserScore") > 0,
  "  ⭐ " + format(prop("UserScore")),
  ""
) +
if(
  prop("ReleaseYear") > 0,
  "  📅 " + format(prop("ReleaseYear")),
  ""
)
`.trim();

// ─── Books Formula ───────────────────────────────────────────────────────────
// Shows: ⭐ 4.25  📄 320 pgs  🏷️ Non-Fiction
const BOOKS_FORMULA = `
if(
  prop("Community Rating") > 0,
  "⭐ " + format(prop("Community Rating")),
  ""
) +
if(
  prop("Total Pages ") > 0,
  "  📄 " + format(prop("Total Pages ")) + " pgs",
  ""
) +
if(
  not empty(prop("Type")),
  "  🏷️ " + prop("Type"),
  ""
)
`.trim();

async function updateFormula(dbId, dbName, propertyName, formulaExpression) {
  console.log(`\n📝 Updating "${dbName}" → "${propertyName}" formula...`);
  try {
    await notion.databases.update({
      database_id: dbId,
      properties: {
        [propertyName]: {
          formula: {
            expression: formulaExpression
          }
        }
      }
    });
    console.log(`  \x1b[32m✅ "${dbName}" formula updated successfully!\x1b[0m`);
  } catch (err) {
    console.error(`  \x1b[31m❌ Failed to update "${dbName}":\x1b[0m`, err.message);
    if (err.body) console.error('  Details:', err.body);
  }
}

async function run() {
  console.log('====================================================');
  console.log('🚀 DEPLOYING QUICK STATS FORMULAS FOR GAMES & BOOKS');
  console.log('====================================================');

  // 1. Update Games Database Formula
  await updateFormula(GAMES_DB_ID, 'Games Library', 'Quick Stats', GAMES_FORMULA);

  // 2. Update Books (Library) Database Formula
  await updateFormula(BOOKS_DB_ID, 'Library (Books)', 'Quick Stats', BOOKS_FORMULA);

  console.log('\n====================================================');
  console.log('🎉 Done! Open your Notion databases to verify.');
  console.log('====================================================\n');
}

run();
