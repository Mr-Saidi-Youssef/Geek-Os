const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_TV_DATABASE_ID;

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error('Error: NOTION_TOKEN or NOTION_TV_DATABASE_ID is not configured.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Cleans search queries for maximum TVMaze search accuracy
function cleanSearchTitle(title) {
  return title
    .replace(/^British\s+/i, '')
    .replace(/^American\s+/i, '')
    .replace(/^Stephen King's\s+/i, '')
    .replace(/^The Being\s+/i, '') // e.g. "The Being Frank Show" -> "Frank Show"
    .replace(/\(UK\)$/i, '')
    .replace(/\(US\)$/i, '')
    .replace(/Black-Adder/i, 'Blackadder')
    .replace(/Black Adder/i, 'Blackadder')
    .replace(/Erufen r\u00EEto/i, 'Elfen Lied')
    .replace(/Poketto Monsut\u00E2/i, 'Pokemon')
    .replace(/Isler G\u00FC\u00E7ler/i, 'Isler Gucler')
    .replace(/Yugio deyueru monsutazu/i, 'Yu-Gi-Oh')
    .replace(/Carniv\u00E0le/i, 'Carnivale')
    .replace(/Behzat \u00C7\./i, 'Behzat C')
    .replace(/Mighty Morphin Power Rangers/i, 'Power Rangers')
    .trim();
}

// Fetches poster cover and network platform from TVMaze search keylessly with fallbacks
async function getTvMazeMetadata(title) {
  // Try multiple fallback variations in order of specificity
  const queryAttempts = [
    title,
    title.replace(/^(The)\s+/i, '').trim(), // e.g. "The Nostalgia Critic" -> "Nostalgia Critic"
    cleanSearchTitle(title),
    title.split(':')[0].trim(), // e.g. "Rurouni Kenshin: Wandering Samurai" -> "Rurouni Kenshin"
    title.split('/')[0].trim(), // e.g. "The Bugs Bunny/Looney Tunes Comedy Hour" -> "The Bugs Bunny"
    title.split(/\s+with\s+/i)[0].trim(), // e.g. "Mr. Show with Bob and David" -> "Mr. Show"
    title.split(/\s+Starring\s+/i)[0].trim(), // e.g. "The Tonight Show Starring Jimmy Fallon" -> "The Tonight Show"
    title.replace(/\s+[IVX]+$/i, '').trim(), // e.g. "Hellsing X" -> "Hellsing"
    title.replace(/\s+the\s+[a-z]+/i, '').trim(), // e.g. "Black Adder the Third" -> "Black Adder"
    title.replace(/\s+Goes\s+Forth/i, '').trim() // e.g. "Blackadder Goes Forth" -> "Blackadder"
  ];
  
  // Clean duplicates and empty queries
  const uniqueQueries = [...new Set(queryAttempts.map(q => q.trim()).filter(Boolean))];
  
  for (const q of uniqueQueries) {
    if (!q) continue;
    
    // 1. Try singlesearch first
    try {
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(q)}`;
      const response = await axios.get(url);
      if (response.data) {
        const largeCover = response.data.image ? (response.data.image.original || response.data.image.medium) : '';
        const network = response.data.network ? response.data.network.name : (response.data.webChannel ? response.data.webChannel.name : '');
        const genres = response.data.genres || [];
        if (largeCover) {
          return { largeCover, network, genres };
        }
      }
    } catch (err) {
      // Singlesearch failed or returned 404, fall through to list search
    }

    // 2. Try list search fallback (handles shows with null cover on the first result like Baywatch)
    try {
      const fallbackUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
      const resFallback = await axios.get(fallbackUrl);
      if (resFallback.data && resFallback.data.length > 0) {
        // Find the first result that actually has a cover poster!
        const matchingShow = resFallback.data.find(d => d.show && d.show.image);
        if (matchingShow) {
          const show = matchingShow.show;
          const largeCover = show.image.original || show.image.medium || '';
          const network = show.network ? show.network.name : (show.webChannel ? show.webChannel.name : '');
          const genres = show.genres || [];
          if (largeCover) {
            return { largeCover, network, genres };
          }
        }
      }
    } catch (e) {
      // List search fallback failed, try next query variation
    }
  }
  return { largeCover: '', network: '', genres: [] };
}

// Scrapes YouTube for trailer URLs keylessly
async function getYoutubeTrailer(title, releaseYear) {
  try {
    const query = encodeURIComponent(`${title} ${releaseYear || ''} official trailer tv series`);
    const searchUrl = `https://www.youtube.com/results?search_query=${query}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  } catch (err) {
    // Fail silently
  }
  return '';
}

async function startRepair() {
  console.log('====================================================');
  console.log('🛠️  Starting Advanced TV Series Cover & Entity Sweep...');
  console.log('====================================================');

  let hasMore = true;
  let cursor = undefined;
  let processedCount = 0;
  let repairedCovers = 0;
  let repairedTitles = 0;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        processedCount++;
        let originalTitle = page.properties.Title.title[0]?.plain_text || '';
        let decodedTitle = decodeHtmlEntities(originalTitle);
        let hasCover = page.cover !== null;
        let hasTrailer = page.properties.Trailer?.url !== null;
        let releaseYear = page.properties.ReleaseYear?.number || '';

        let needsTitleRepair = originalTitle !== decodedTitle;
        let needsCoverRepair = !hasCover;

        if (needsTitleRepair || needsCoverRepair) {
          console.log(`\nAnalyzing: "${originalTitle}"`);
          const updateData = {
            page_id: page.id,
            properties: {}
          };

          // 1. Repair Title
          if (needsTitleRepair) {
            console.log(`  Decoded Title: \x1b[32m"${decodedTitle}"\x1b[0m`);
            updateData.properties['Title'] = {
              title: [{ text: { content: decodedTitle } }]
            };
            repairedTitles++;
          }

          // 2. Repair Cover Poster & Platform Network
          if (needsCoverRepair) {
            const titleToSearch = decodedTitle; // Use decoded clean title!
            console.log(`  Searching TVMaze cover for: "${titleToSearch}"...`);
            const metadata = await getTvMazeMetadata(titleToSearch);

            if (metadata.largeCover) {
              console.log(`  \x1b[32mFound Cover:\x1b[0m ${metadata.largeCover}`);
              updateData.cover = {
                type: 'external',
                external: { url: metadata.largeCover }
              };
              repairedCovers++;

              if (metadata.network) {
                console.log(`  Found Platform Network: ${metadata.network}`);
                updateData.properties['Platform'] = {
                  multi_select: [{ name: metadata.network }]
                };
              }
            } else {
              console.log(`  \x1b[31m⚠️  Failed to resolve cover for "${titleToSearch}"\x1b[0m`);
            }
          }

          // 3. Repair Trailer (if missing)
          if (!hasTrailer) {
            const titleToSearch = decodedTitle;
            console.log(`  Searching YouTube trailer for: "${titleToSearch}"...`);
            const trailerUrl = await getYoutubeTrailer(titleToSearch, releaseYear);
            if (trailerUrl) {
              console.log(`  \x1b[32mFound Trailer:\x1b[0m ${trailerUrl}`);
              updateData.properties['Trailer'] = {
                url: trailerUrl
              };
            }
          }

          // Write updates in Notion
          try {
            await notion.pages.update(updateData);
            // safe limit delay
            await sleep(350);
          } catch (e) {
            console.error(`  Error updating page in Notion:`, e.message);
          }
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    console.log('\n====================================================');
    console.log('🎉 Advanced TV Series Cover & Entity Sweep Complete!');
    console.log(`🟢 Successfully Repaired Titles: ${repairedTitles}`);
    console.log(`🟢 Successfully Repaired Covers: ${repairedCovers}`);
    console.log(`⚪ Total Pages Processed: ${processedCount}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in repair script:', error.message);
  }
}

startRepair();
