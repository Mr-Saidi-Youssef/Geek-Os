const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf19d0815bb5d3d51ed587a7d1';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not defined in the environment or .env file');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function run() {
  console.log('Querying all games to inspect genres, titles, and synopses...');
  
  let allPages = [];
  let cursor;
  
  try {
    do {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
        page_size: 100
      });
      allPages = allPages.concat(response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
    
    console.log(`Total games found: ${allPages.length}`);
    
    // Analyze genres and scan titles/synopses for adult keywords
    const adultKeywords = ['hentai', 'adult', 'erotica', 'ecchi', 'porn', 'sex', 'uncensored', 'nudity', 'nude'];
    const suspiciousGames = [];
    
    const allGenres = new Set();
    
    for (const page of allPages) {
      let title = '';
      for (const key of Object.keys(page.properties)) {
        if (page.properties[key].type === 'title') {
          title = page.properties[key].title[0]?.plain_text || 'Untitled';
          break;
        }
      }
      
      const genreProp = page.properties['Genre'];
      const genres = genreProp && genreProp.type === 'multi_select' 
        ? genreProp.multi_select.map(g => g.name) 
        : [];
      
      genres.forEach(g => allGenres.add(g));
      
      const synopsisProp = page.properties['Synopsis'];
      const synopsis = synopsisProp && synopsisProp.type === 'rich_text'
        ? synopsisProp.rich_text.map(t => t.plain_text).join('')
        : '';
        
      // Check if any genre, title, or synopsis contains adult/mature keywords
      const lowerTitle = title.toLowerCase();
      const lowerSynopsis = synopsis.toLowerCase();
      
      const matchedKeywords = [];
      for (const keyword of adultKeywords) {
        // Simple word match check (to avoid false positives like "Essex", "Sexagesimal", "sexy")
        const wordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (wordRegex.test(lowerTitle) || wordRegex.test(lowerSynopsis) || genres.some(g => g.toLowerCase().includes(keyword))) {
          matchedKeywords.push(keyword);
        }
      }
      
      // Also check for specific "sexy" because it could be borderline
      if (lowerTitle.includes('sexy') || lowerSynopsis.includes('sexy') || genres.some(g => g.toLowerCase().includes('sexy'))) {
        matchedKeywords.push('sexy (contains)');
      }
      
      if (matchedKeywords.length > 0) {
        suspiciousGames.push({
          title,
          genres,
          matchedKeywords,
          synopsis: synopsis.substring(0, 150),
          archived: page.archived
        });
      }
    }
    
    console.log('\n--- All Genres Found in Database ---');
    console.log(Array.from(allGenres).sort().join(', '));
    
    console.log('\n--- Suspicious / Mature Content Matches ---');
    if (suspiciousGames.length === 0) {
      console.log('No suspicious or adult content matches found.');
    } else {
      console.log(`Found ${suspiciousGames.length} potential matches:`);
      suspiciousGames.forEach((g, idx) => {
        console.log(`\n[${idx + 1}] Title: "${g.title}" (Archived: ${g.archived})`);
        console.log(`    Genres: ${g.genres.join(', ') || 'None'}`);
        console.log(`    Matched Keywords: ${g.matchedKeywords.join(', ')}`);
        console.log(`    Synopsis: "${g.synopsis}..."`);
      });
    }
    
  } catch (err) {
    console.error('Error querying Notion database:', err);
  }
}

run();
