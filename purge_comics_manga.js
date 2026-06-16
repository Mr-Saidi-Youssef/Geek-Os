/**
 * Purge Manga from Comics Library
 * Scans the Comics database and archives any Japanese manga, ensuring only Western comics remain.
 * Powered by Notion SDK
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_COMICS_DATABASE_ID || '371d0aaf19d081c59b14fbc0c52b0040';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Precise Japanese Kana/Kanji regex
const jpRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;

// Known manga creators / keywords
const mangaKeywords = [
  'manga', 'japan', 'shonen', 'shojo', 'seinen', 'josei', 'anime', 
  'kishimoto', 'toriyama', 'akutami', 'oda', 'ito,', 'itō', 'ohba', 'obata', 
  'miura', 'urasawa', 'takahashi', 'kubo', 'horikoshi', 'gotoge', 'takami', 'otomo', 'ōtomo'
];

function isManga(title, writer, artist, genres) {
  const lowerTitle = title.toLowerCase();
  const lowerWriter = writer.toLowerCase();
  const lowerArtist = artist.toLowerCase();
  
  // 1. Check title / author characters for Japanese text
  if (jpRegex.test(title) || jpRegex.test(writer) || jpRegex.test(artist)) {
    return true;
  }
  
  // 2. Check title, writer, artist for known manga terms
  if (mangaKeywords.some(kw => lowerTitle.includes(kw) || lowerWriter.includes(kw) || lowerArtist.includes(kw))) {
    return true;
  }

  // 3. Check genres
  if (genres && Array.isArray(genres)) {
    if (genres.some(g => g.toLowerCase().includes('manga'))) return true;
  }

  // 4. Specific popular manga titles in the seed list
  const mangaTitles = ['uzumaki', 'bleach', 'naruto', 'berserk', 'jujutsu', 'death note', 'dragon ball', 'akira', 'battle royale', 'my hero academia'];
  if (mangaTitles.some(t => lowerTitle.includes(t))) {
    return true;
  }

  return false;
}

async function purgeManga() {
  console.log('====================================================');
  console.log('🌸 Purging Japanese Manga from Comics Library');
  console.log('====================================================\n');

  try {
    console.log('Querying all Comics pages from Notion...');
    const pages = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100
      });
      pages.push(...response.results);
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      await sleep(350);
    }

    console.log(`Auditing ${pages.length} total comic pages...\n`);
    let archivedCount = 0;

    for (const page of pages) {
      const title = page.properties.Title?.title?.map(t => t.plain_text).join('').trim() || '';
      const writer = page.properties.Writer?.rich_text?.map(t => t.plain_text).join('').trim() || '';
      const artist = page.properties.Artist?.rich_text?.map(t => t.plain_text).join('').trim() || '';
      const genres = page.properties.Genres?.multi_select?.map(g => g.name) || [];

      if (title === 'New Comics' || page.id === '371d0aaf-19d0-8008-8c08-c9f95a2449f4') {
        continue; // protect template page
      }

      if (isManga(title, writer, artist, genres)) {
        console.log(`\x1b[31m[ARCHIVING MANGA]\x1b[0m "${title}" by ${writer}`);
        
        // Archive the page in Notion
        await notion.pages.update({
          page_id: page.id,
          archived: true
        });
        archivedCount++;
        await sleep(350); // respect rate limits
      }
    }

    console.log('\n====================================================');
    console.log('🎉 Manga Purge Sweep Complete!');
    console.log(`🔴 Total Manga pages archived: ${archivedCount}`);
    console.log(`🟢 Remaining Western Comic pages in database: ${pages.length - archivedCount}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Error during Manga purge:', error.message);
  }
}

purgeManga();
