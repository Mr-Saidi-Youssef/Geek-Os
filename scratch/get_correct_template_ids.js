const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const DB_IDS = {
  anime: process.env.NOTION_DATABASE_ID || '36dd0aaf19d0800792e7dca0434c570c',
  manga: process.env.NOTION_MANGA_DATABASE_ID || '370d0aaf-19d0-8121-a36f-f3dfcc914532',
  game: process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf-19d0-815b-b5d3-d51ed587a7d1',
  comic: process.env.NOTION_COMICS_DATABASE_ID || '371d0aaf-19d0-81c5-b914-fbc0c52b0040',
  movie: process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa',
  tv: process.env.NOTION_TV_DATABASE_ID || '36dd0aaf-19d0-8123-893f-cbaf9bff624a',
  book: '8b2780bfd84442d8bcd95223152c0ece'
};

const TEMPLATE_NAMES = {
  anime: 'New Anime',
  manga: 'New Manga',
  game: 'New Games',
  comic: 'New Comics',
  movie: 'New Movie',
  tv: 'New Series',
  book: 'New Book'
};

async function findTemplates() {
  console.log('🔍 Scanning database pages to find correct templates...');
  for (const [type, dbId] of Object.entries(DB_IDS)) {
    const cleanDbId = dbId.replace(/-/g, '');
    console.log(`\n────────────────────────────────────────`);
    console.log(`Type: ${type} | Database ID: ${cleanDbId}`);
    console.log(`────────────────────────────────────────`);
    try {
      // We search pages inside this database
      const res = await notion.databases.query({
        database_id: cleanDbId,
      });

      console.log(`Database has ${res.results.length} total pages. Candidates:`);
      let found = false;
      for (const page of res.results) {
        const title = page.properties?.Title?.title?.map(x => x.plain_text).join('') ||
                      page.properties?.Name?.title?.map(x => x.plain_text).join('') || 
                      page.properties?.title?.title?.map(x => x.plain_text).join('') || '';
        
        const cleanTitle = title.trim();
        // If it starts with 'New' or is a template
        if (cleanTitle.toLowerCase().startsWith('new ') || cleanTitle.toLowerCase() === 'template' || cleanTitle.toLowerCase().includes('new')) {
          console.log(`  * FOUND * Title: "${title}" | ID: ${page.id} | URL: ${page.url}`);
          found = true;
        }
      }
      if (!found) {
        console.log(`  ❌ No page matching 'New' found in database directly. Trying search API...`);
        const searchName = TEMPLATE_NAMES[type];
        const searchRes = await notion.search({
          query: searchName,
          filter: { value: 'page', property: 'object' }
        });
        console.log(`  Search results for "${searchName}" (matches title):`);
        for (const p of searchRes.results) {
          const title = p.properties?.Title?.title?.map(x => x.plain_text).join('') ||
                        p.properties?.Name?.title?.map(x => x.plain_text).join('') ||
                        p.properties?.title?.title?.map(x => x.plain_text).join('') || '(Untitled)';
          if (title.toLowerCase().includes('new')) {
            console.log(`    - Title: "${title}" | ID: ${p.id} | Parent: ${p.parent.type} ID: ${p.parent.database_id || p.parent.page_id}`);
          }
        }
      }
    } catch (err) {
      console.error(`  ❌ Error querying db for ${type}:`, err.message);
    }
  }
}

findTemplates();
