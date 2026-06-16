/**
 * Personal Rating System Sync
 * Configures the unified 10-star single-select personal rating property ("Score")
 * across all other media databases (Series, Movies, Manga, Books, Comics, Games)
 * to perfectly match your Anime database scoring options and colors.
 *
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;

// ─── Target Databases Schema & IDs ───────────────────────────────────────────
const DATABASES = [
  { name: "TV Series Library", id: process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a' },
  { name: "Movies Library",    id: process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa' },
  { name: "Games Library",     id: process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf19d0815bb5d3d51ed587a7d1' },
  { name: "Manga Library",     id: process.env.NOTION_MANGA_DATABASE_ID || '370d0aaf19d08121a36ff3dfcc914532' },
  { name: "Comics Library",    id: process.env.NOTION_COMICS_DATABASE_ID || '371d0aaf19d081c59b14fbc0c52b0040' },
  { name: "Books Library",     id: '8b2780bfd84442d8bcd95223152c0ece' }
];

// Exact options and colors from your Anime Watchlist select configuration
const RATING_OPTIONS = [
  { name: "(10) Masterpiece", color: "red" },
  { name: "(9) Great",        color: "green" },
  { name: "(8) Very Good",    color: "brown" },
  { name: "(7) Good",         color: "blue" },
  { name: "(6) Fine",         color: "pink" },
  { name: "(5) Average",      color: "purple" },
  { name: "(4) Bad",          color: "orange" },
  { name: "(3) Very Bad",     color: "gray" },
  { name: "(2) Horrible",     color: "yellow" },
  { name: "(1) Appalling",    color: "gray" }
];

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not configured in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(apiCall, retries = 10, delayMs = 15000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      const isRateLimit = error.status === 429 || 
                          error.code === 'rate_limited' || 
                          error.message?.includes('429');
      
      if (isRateLimit && attempt < retries) {
        const waitSec = Math.pow(2, attempt) * 2 + 5;
        console.log(`  ⏳ Rate limited — waiting ${waitSec}s (attempt ${attempt + 1}/${retries})...`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw error;
    }
  }
}

async function configureRatingProperty(db) {
  console.log(`\n----------------------------------------------------`);
  console.log(`🛠️  Configuring Rating System for: "${db.name}"`);
  console.log(`   ID: ${db.id}`);
  console.log(`----------------------------------------------------`);

  try {
    // 1. Retrieve the database first to see what rating-like properties currently exist
    const schema = await withRetry(() => notion.databases.retrieve({ database_id: db.id }));
    
    // Find if there is an existing "Score" or "Personal Rating" property
    const existingProperties = Object.keys(schema.properties);
    
    // Check all common rating property names
    const ratingPropNames = ["Score", "Personal Rating", "My rating", "Rating", "rating"];
    const propertiesToUpdate = [];
    
    for (const name of ratingPropNames) {
      if (existingProperties.includes(name)) {
        propertiesToUpdate.push(name);
      }
    }
    
    // If none exists, we'll create "Score" by default to match Anime!
    if (propertiesToUpdate.length === 0) {
      propertiesToUpdate.push("Score");
    }

    const updatePayload = {
      database_id: db.id,
      properties: {}
    };

    for (const propName of propertiesToUpdate) {
      console.log(`👉 Configuring select property "${propName}" with the 10-star rating system...`);
      updatePayload.properties[propName] = {
        select: {
          options: RATING_OPTIONS
        }
      };
    }

    await withRetry(() => notion.databases.update(updatePayload));
    console.log(`\x1b[32m✅ Successfully synced rating options for: "${db.name}"!\x1b[0m`);

  } catch (err) {
    console.error(`\x1b[31m❌ Failed to configure "${db.name}":\x1b[0m`, err.message);
  }
  await sleep(1000); // polite pause between databases
}

async function run() {
  console.log('====================================================');
  console.log('🌟 UNIFIED PERSONAL RATING SYSTEM SYNC ENGINE');
  console.log('   Replicating Anime 10-Star scale to all databases');
  console.log('====================================================\n');

  for (const db of DATABASES) {
    await configureRatingProperty(db);
  }

  console.log('\n====================================================');
  console.log('🎉 RATING OPTIONS SYNC COMPLETE!');
  console.log('   Open your Notion workspace to enjoy the unified scale!');
  console.log('====================================================\n');
}

run();
