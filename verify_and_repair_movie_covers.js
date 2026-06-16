const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MOVIE_DB_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';

if (!NOTION_TOKEN || !MOVIE_DB_ID) {
  console.error('Error: NOTION_TOKEN or NOTION_MOVIE_DATABASE_ID is not configured.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MANUAL_COVER_OVERRIDES = {
  'escape from alcatraz': 'https://en.wikipedia.org/wiki/Special:FilePath/Escape_from_alcatraz.jpg',
  'lola rennt': 'https://en.wikipedia.org/wiki/Special:FilePath/Lola_Rennt_poster.jpg',
  'run lola run': 'https://en.wikipedia.org/wiki/Special:FilePath/Lola_Rennt_poster.jpg'
};

const TITLE_TRANSLATION_MAP = {
  'lilja 4-ever': 'Lilya 4-ever',
  'tky goddofzzu': 'Tokyo Godfathers',
  'forushande': 'The Salesman',
  'trois couleurs: bleu': 'Three Colors: Blue',
  'hable con ella': 'Talk to Her',
  '4 luni, 3 saptamni si 2 zile': '4 Months, 3 Weeks and 2 Days',
  'bir zamanlar anadolu\'da': 'Once Upon a Time in Anatolia',
  'per un pugno di dollari': 'A Fistful of Dollars',
  'portrait de la jeune fille en feu': 'Portrait of a Lady on Fire',
  'smultronstllet': 'Wild Strawberries',
  'hstsonaten': 'Autumn Sonata',
  'per qualche dollaro in pi': 'For a Few Dollars More',
  'shichinin no samurai': 'Seven Samurai'
};

// Decodes all HTML entities robustly
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#([0-9]+);/gi, (match, numStr) => {
      const num = parseInt(numStr, 10);
      return String.fromCharCode(num);
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, hexStr) => {
      const num = parseInt(hexStr, 16);
      return String.fromCharCode(num);
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Converts low-resolution Amazon thumbnails/posters to high-resolution original covers
function getHighResPoster(url) {
  if (!url) return '';
  if (url.includes('m.media-amazon.com/images/')) {
    // Strip resizing suffix (e.g. _SX300.jpg or _SY500_CR...jpg)
    return url.replace(/@\._V1_.*\.jpg$/, '@.jpg');
  }
  return url;
}

// Cleans search queries for maximum search accuracy
function cleanSearchTitle(title) {
  return title
    .replace(/^British\s+/i, '')
    .replace(/^American\s+/i, '')
    .replace(/\(UK\)$/i, '')
    .replace(/\(US\)$/i, '')
    .trim();
}

// Fetches poster cover from OMDb API keylessly
async function getOmdbCover(title) {
  const queryAttempts = [
    title,
    title.replace(/^(The)\s+/i, '').trim(),
    cleanSearchTitle(title),
    title.split(':')[0].trim(),
    title.split('/')[0].trim()
  ];
  
  const uniqueQueries = [...new Set(queryAttempts.map(q => q.trim()).filter(Boolean))];
  
  for (const q of uniqueQueries) {
    try {
      const url = `http://www.omdbapi.com/?t=${encodeURIComponent(q)}&apikey=thewdb`;
      const res = await axios.get(url);
      if (res.data && res.data.Poster && res.data.Poster.startsWith('http') && !res.data.Poster.includes('N/A')) {
        return getHighResPoster(res.data.Poster);
      }
    } catch (err) {
      // Continue
    }
  }
  return '';
}

// Fetches poster cover from TVMaze search keylessly
async function getTvMazeCover(title) {
  const queryAttempts = [
    title,
    title.replace(/^(The)\s+/i, '').trim(),
    cleanSearchTitle(title),
    title.split(':')[0].trim(),
    title.split('/')[0].trim()
  ];
  
  const uniqueQueries = [...new Set(queryAttempts.map(q => q.trim()).filter(Boolean))];
  
  for (const q of uniqueQueries) {
    if (!q) continue;
    
    // Try Singlesearch first
    try {
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(q)}`;
      const response = await axios.get(url);
      if (response.data) {
        const largeCover = response.data.image ? (response.data.image.original || response.data.image.medium) : '';
        if (largeCover) return largeCover;
      }
    } catch (err) {
      // Continue to list search fallback
    }

    // Try List Search fallback
    try {
      const fallbackUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
      const resFallback = await axios.get(fallbackUrl);
      if (resFallback.data && resFallback.data.length > 0) {
        const matchingShow = resFallback.data.find(d => d.show && d.show.image);
        if (matchingShow) {
          const largeCover = matchingShow.show.image.original || matchingShow.show.image.medium || '';
          if (largeCover) return largeCover;
        }
      }
    } catch (e) {
      // Try next variation
    }
  }
  return '';
}

// Tests if an image URL is alive
async function isUrlAlive(url) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const res = await axios.head(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    return res.status === 200;
  } catch (err) {
    return false;
  }
}

async function verifyAndRepair() {
  console.log('====================================================');
  console.log('🔍 Starting Deep Verification of Movie Covers URL Health...');
  console.log('====================================================');

  let hasMore = true;
  let cursor = undefined;
  let processed = 0;
  let brokenCount = 0;
  let fixedCount = 0;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: MOVIE_DB_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        processed++;
        let title = '';
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            title = prop.title[0].plain_text;
            break;
          }
        }

        if (!title) continue;

        let decodedTitle = decodeHtmlEntities(title);
        const cover = page.cover;
        const coverUrl = cover && cover.external ? cover.external.url : '';

        let isCoverBroken = false;
        if (!coverUrl) {
          isCoverBroken = true;
          console.log(`[Missing Cover] "${decodedTitle}"`);
        } else {
          // Check if cover URL returns success
          const alive = await isUrlAlive(coverUrl);
          if (!alive) {
            isCoverBroken = true;
            brokenCount++;
            console.log(`[Broken Cover Link] "${decodedTitle}" (URL: ${coverUrl})`);
          }
        }

        if (isCoverBroken) {
          console.log(`  Attempting repair for "${decodedTitle}"...`);
          
          let newCover = '';
          const lowerTitle = decodedTitle.toLowerCase().trim();
          if (MANUAL_COVER_OVERRIDES[lowerTitle]) {
            newCover = MANUAL_COVER_OVERRIDES[lowerTitle];
            console.log(`  \x1b[32mFound Cover in Manual Overrides:\x1b[0m ${newCover}`);
          } else {
            const queryTitle = TITLE_TRANSLATION_MAP[lowerTitle] || decodedTitle;
            if (TITLE_TRANSLATION_MAP[lowerTitle]) {
              console.log(`  Translating Title: "${decodedTitle}" -> "${queryTitle}"`);
            }
            
            // 1. Try OMDb first (high matching rate for theatrical movies)
            newCover = await getOmdbCover(queryTitle);
            if (newCover) {
              console.log(`  \x1b[32mFound Cover on OMDb:\x1b[0m ${newCover}`);
            } else {
              // 2. Try TVMaze as fallback
              newCover = await getTvMazeCover(queryTitle);
              if (newCover) {
                console.log(`  \x1b[32mFound Cover on TVMaze:\x1b[0m ${newCover}`);
              }
            }
          }

          if (newCover) {
            console.log(`  \x1b[32mSuccessfully resolved new cover:\x1b[0m ${newCover}`);
            try {
              await notion.pages.update({
                page_id: page.id,
                cover: {
                  type: 'external',
                  external: { url: newCover }
                }
              });
              fixedCount++;
              await sleep(350); // safe limit delay
            } catch (err) {
              console.error(`  Failed to update page cover in Notion:`, err.message);
            }
          } else {
            console.log(`  \x1b[31m⚠️  Failed to resolve any replacement cover for "${decodedTitle}"\x1b[0m`);
          }
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    console.log('\n====================================================');
    console.log('🎉 Deep Movie Cover Verification & Repair Complete!');
    console.log(`🟢 Total Pages Checked: ${processed}`);
    console.log(`🔴 Total Broken Covers Found: ${brokenCount}`);
    console.log(`🟢 Successfully Repaired Covers: ${fixedCount}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in deep verification script:', error.message);
  }
}

verifyAndRepair();
