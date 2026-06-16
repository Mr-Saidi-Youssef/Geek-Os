const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MASTER_DB_ID = '36dd0aaf19d0800792e7dca0434c570c';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(fn, retries = 15, delayMs = 30000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.status === 429 || err?.code === 'rate_limited' || err?.message?.includes('429');
      const isTransient = err?.status >= 500;
      if ((is429 || isTransient) && attempt < retries) {
        const waitSec = Math.pow(2, attempt) * 2 + 5;
        console.log(`  ⏳ Rate limited — waiting ${waitSec}s (attempt ${attempt + 1}/${retries})...`);
        await sleep(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
}

// 7 nested if statements -> exactly 7 closing parentheses at the end )))))))
const FORMULA_EXPRESSION = `
if(!empty(join(map(prop("Games"), format(current)), ", ")), "🎮 Game", if(!empty(join(map(prop("Anime"), format(current)), ", ")), "🌸 Anime", if(!empty(join(map(prop("TV Series"), format(current)), ", ")), "📺 TV Series", if(!empty(join(map(prop("Movies"), format(current)), ", ")), "🎬 Movie", if(!empty(join(map(prop("Manga"), format(current)), ", ")), "📖 Manga", if(!empty(join(map(prop("Comics"), format(current)), ", ")), "🎨 Comic", if(!empty(join(map(prop("Books"), format(current)), ", ")), "📚 Book", "📝 General")))))))
`.trim();

async function run() {
  console.log('====================================================');
  console.log('📝 Updating Media Type Formula in Master Watchlist');
  console.log('====================================================\n');

  // Try common property names: "Media Type", "Type", "Format"
  const potentialProperties = ['Media Type', 'Type', 'Format'];
  let success = false;

  for (const propName of potentialProperties) {
    console.log(`Trying to update property "${propName}" with the new formula...`);
    try {
      await withRetry(() => notion.databases.update({
        database_id: MASTER_DB_ID,
        properties: {
          [propName]: {
            formula: {
              expression: FORMULA_EXPRESSION
            }
          }
        }
      }));
      console.log(`  ✅ Successfully updated "${propName}" formula!`);
      success = true;
      break;
    } catch (err) {
      if (err.message.includes('validation_error') || err.message.includes('conflict')) {
        console.log(`  ℹ "${propName}" is not the target property (or holds different type/relation names). Trying next...`);
      } else {
        console.error(`  ❌ Error updating "${propName}":`, err.message);
      }
    }
    await sleep(1000);
  }

  if (!success) {
    console.log('\n❌ Could not automatically determine and update the formula property.');
    console.log('Here is the formula for you to copy and paste manually into your Notion property settings:');
    console.log('\n----------------------------- COPY BELOW -----------------------------');
    console.log(FORMULA_EXPRESSION);
    console.log('----------------------------------------------------------------------\n');
  } else {
    console.log('\n====================================================');
    console.log('🎉 Update Successful! Check your master database to verify.');
    console.log('====================================================\n');
  }
}

run();
