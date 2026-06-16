/**
 * update_formula.js
 * Updates the "Quick Stats" formula property in the TV Series and Movies
 * Notion databases to include Seasons and Episodes data.
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TV_DB_ID     = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';
const MOVIES_DB_ID = '7ab340245e7e4b22a3685608e103c0aa';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not configured in .env');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

// ─── TV Series Formula ────────────────────────────────────────────────────────
// Shows: ⭐ 8.5  📅 2011  📺 5 seasons · 62 eps  ⏱ 45 min
const TV_FORMULA = `
if(
  prop("IMDbRating") != 0,
  "⭐ " + format(prop("IMDbRating")),
  ""
) +
if(
  prop("ReleaseYear") != 0,
  "  📅 " + format(prop("ReleaseYear")),
  ""
) +
if(
  prop("Seasons") != 0,
  "  📺 " + format(prop("Seasons")) + if(prop("Seasons") == 1, " season", " seasons"),
  ""
) +
if(
  prop("Episodes") != 0,
  " · " + format(prop("Episodes")) + " eps",
  ""
) +
if(
  prop("Runtime") != 0,
  "  ⏱ " + format(prop("Runtime")) + " min",
  ""
)
`.trim();

// ─── Movies Formula ───────────────────────────────────────────────────────────
// Shows: ⭐ 8.8  📅 1994  ⏱ 142 min
const MOVIES_FORMULA = `
if(
  prop("IMDbRating") != 0,
  "⭐ " + format(prop("IMDbRating")),
  ""
) +
if(
  prop("ReleaseYear") != 0,
  "  📅 " + format(prop("ReleaseYear")),
  ""
) +
if(
  prop("Runtime") != 0,
  "  ⏱ " + format(prop("Runtime")) + " min",
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
    console.log(`  ✅ "${dbName}" formula updated successfully!`);
  } catch (err) {
    console.error(`  ❌ Failed to update "${dbName}":`, err.message);
    if (err.body) console.error('  Details:', err.body);
  }
}

async function run() {
  console.log('====================================================');
  console.log('🚀 Updating Quick Stats Formulas...');
  console.log('====================================================');

  await updateFormula(TV_DB_ID,     'Series Library', 'Quick Stats',  TV_FORMULA);
  await updateFormula(MOVIES_DB_ID, 'Movies Library', 'Quick Info',   MOVIES_FORMULA);

  console.log('\n====================================================');
  console.log('🎉 Done! Open your Notion databases to verify.');
  console.log('====================================================\n');
}

run();
