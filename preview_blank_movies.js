/**
 * preview_blank_movies.js
 * Quick scan — lists all movies that have an empty page body (no blocks).
 * This is a safe read-only preview before running enrich_all_movies.js.
 */
const { Client } = require('@notionhq/client');
require('dotenv').config();

const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const notion = new Client({ auth: process.env.NOTION_TOKEN });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getPageTitle(page) {
  for (const [, value] of Object.entries(page.properties)) {
    if (value.type === 'title') return value.title.map(t => t.plain_text).join('').trim();
  }
  return '(Untitled)';
}

async function run() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('🔍  PREVIEW: Scanning for movies with empty page bodies...');
  console.log('══════════════════════════════════════════════════════════\n');

  let allPages = [], cursor;
  do {
    const res = await notion.databases.query({ database_id: DATABASE_ID, start_cursor: cursor, page_size: 100 });
    allPages = allPages.concat(res.results);
    cursor   = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  console.log(`Total movies in database: ${allPages.length}\n`);

  const blank = [], filled = [];
  for (let i = 0; i < allPages.length; i++) {
    const page  = allPages[i];
    const title = getPageTitle(page);
    process.stdout.write(`\r  Checking ${i + 1}/${allPages.length}...`);
    const res = await notion.blocks.children.list({ block_id: page.id, page_size: 1 });
    if (res.results.length === 0) blank.push(title);
    else filled.push(title);
    if (i < allPages.length - 1) await sleep(250);
  }

  console.log(`\n\n══════════════════════════════════════════════════════════`);
  console.log(`📊  RESULTS`);
  console.log(`══════════════════════════════════════════════════════════`);
  console.log(`   Already enriched : ${filled.length} pages`);
  console.log(`   Will be enriched : ${blank.length} pages`);
  console.log(`══════════════════════════════════════════════════════════`);

  if (blank.length > 0) {
    console.log(`\n📝  Movies that will receive the template layout:`);
    blank.forEach((t, i) => console.log(`   ${i + 1}. ${t}`));
  }
  console.log('');
}

run();
