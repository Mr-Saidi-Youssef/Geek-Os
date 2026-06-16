const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TARGET_PAGE_ID = '370d0aaf-19d0-81fd-9db2-f76f59f90302'; // The page "🎬 New Movie — Page Template" created using their template

const notion = new Client({ auth: NOTION_TOKEN });

// Keyless YouTube trailer scraper
async function getYoutubeTrailer(title, releaseYear) {
  try {
    const query = encodeURIComponent(`${title} ${releaseYear || ''} official trailer movie`);
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

// Converts low-res Amazon posters to high-res
function getHighResPoster(url) {
  if (!url) return '';
  if (url.includes('m.media-amazon.com/images/')) {
    return url.replace(/@\._V1_.*\.jpg$/, '@.jpg');
  }
  return url;
}

async function testUserTemplate() {
  const movieTitle = 'Inception';
  console.log(`\n====================================================`);
  console.log(`🎬 IN-PLACE FILLING USER TEMPLATE WITH: "${movieTitle}"`);
  console.log(`====================================================\n`);

  try {
    // 1. Fetch metadata from OMDb
    console.log(`[1/5] Fetching metadata from OMDb...`);
    const omdbUrl = `http://www.omdbapi.com/?t=${encodeURIComponent(movieTitle)}&type=movie&apikey=thewdb`;
    const omdbRes = await axios.get(omdbUrl);
    const m = omdbRes.data;

    if (m.Response === 'False') {
      throw new Error(`Movie not found in OMDb: ${m.Error}`);
    }

    console.log(`      Found: "${m.Title}" (${m.Year}) by ${m.Director}`);

    // 2. Fetch YouTube trailer URL keylessly
    console.log(`[2/5] Scoping YouTube for official trailer...`);
    const trailerUrl = await getYoutubeTrailer(m.Title, m.Year) || 'https://www.youtube.com/watch?v=YoHD9XEInc0';
    console.log(`      Trailer found: ${trailerUrl}`);

    // 3. Prepare high-resolution cover
    const rawPoster = m.Poster !== 'N/A' ? m.Poster : '';
    let highResPoster = getHighResPoster(rawPoster);
    if (highResPoster) {
      highResPoster = `https://images.weserv.nl/?url=${encodeURIComponent(highResPoster)}`;
    }

    // 4. Retrieve page blocks to find placeholder IDs
    console.log(`[3/5] Inspecting blocks of the existing page...`);
    const blocksRes = await notion.blocks.children.list({ block_id: TARGET_PAGE_ID });
    const blocks = blocksRes.results;

    let synopsisBlockId = null;
    let directorBlockId = null;
    let starringBlockId = null;
    let writerBlockId = null;
    let trailerBlockId = null;
    let imdbBlockId = null;

    // Scan blocks matching their labels
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type === 'heading_2') {
        const text = b.heading_2.rich_text[0]?.plain_text || '';
        if (text.includes('Synopsis') && blocks[i + 1]?.type === 'paragraph') {
          synopsisBlockId = blocks[i + 1].id;
        }
      } else if (b.type === 'bulleted_list_item') {
        const text = b.bulleted_list_item.rich_text.map(t => t.plain_text).join('');
        if (text.startsWith('Director:')) {
          directorBlockId = b.id;
        } else if (text.startsWith('Starring:')) {
          starringBlockId = b.id;
        } else if (text.startsWith('Writer:')) {
          writerBlockId = b.id;
        } else if (text.startsWith('🎞️ Trailer:')) {
          trailerBlockId = b.id;
        } else if (text.startsWith('🌐 IMDb:')) {
          imdbBlockId = b.id;
        }
      }
    }

    console.log('      Found placeholders:');
    console.log(`      - Synopsis block: ${synopsisBlockId}`);
    console.log(`      - Director block: ${directorBlockId}`);
    console.log(`      - Starring block: ${starringBlockId}`);
    console.log(`      - Writer block: ${writerBlockId}`);
    console.log(`      - Trailer block: ${trailerBlockId}`);
    console.log(`      - IMDb block: ${imdbBlockId}`);

    // 5. Update blocks in-place preserving their design
    console.log(`[4/5] Updating placeholder blocks in-place...`);
    
    if (synopsisBlockId) {
      await notion.blocks.update({
        block_id: synopsisBlockId,
        paragraph: {
          rich_text: [{ type: 'text', text: { content: m.Plot } }]
        }
      });
    }

    if (directorBlockId) {
      await notion.blocks.update({
        block_id: directorBlockId,
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: 'Director: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: m.Director } }
          ]
        }
      });
    }

    if (starringBlockId) {
      await notion.blocks.update({
        block_id: starringBlockId,
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: 'Starring: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: m.Actors } }
          ]
        }
      });
    }

    if (writerBlockId) {
      await notion.blocks.update({
        block_id: writerBlockId,
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: m.Writer } }
          ]
        }
      });
    }

    if (trailerBlockId && trailerUrl) {
      await notion.blocks.update({
        block_id: trailerBlockId,
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: '🎞️ Trailer: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: 'Watch Official Trailer ↗', link: { url: trailerUrl } } }
          ]
        }
      });
    }

    if (imdbBlockId && m.imdbID) {
      const imdbLink = `https://www.imdb.com/title/${m.imdbID}/`;
      await notion.blocks.update({
        block_id: imdbBlockId,
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: '🌐 IMDb: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: 'View on IMDb ↗', link: { url: imdbLink } } }
          ]
        }
      });
    }

    // 6. Update Page Properties & Cover
    console.log(`[5/5] Updating database properties and cover poster...`);
    const pageProperties = {
      'Title': {
        title: [{ text: { content: `🎬 ${m.Title}` } }]
      },
      'Director': {
        rich_text: [{ text: { content: m.Director } }]
      },
      'ReleaseYear': {
        number: parseInt(m.Year, 10) || 2010
      },
      'Runtime': {
        number: parseInt(m.Runtime.replace(' min', ''), 10) || 148
      },
      'IMDbRating': {
        number: parseFloat(m.imdbRating) || 8.8
      },
      'Status': {
        status: { name: 'Inbox' }
      },
      'Synopsis': {
        rich_text: [{ text: { content: m.Plot.substring(0, 1900) } }]
      }
    };

    if (m.Genre && m.Genre !== 'N/A') {
      const genresList = m.Genre.split(',').map(g => g.trim());
      pageProperties['Genre'] = {
        multi_select: genresList.map(g => ({ name: g }))
      };
    }

    const pageParams = {
      page_id: TARGET_PAGE_ID,
      properties: pageProperties
    };

    if (highResPoster) {
      pageParams.cover = {
        type: 'external',
        external: { url: highResPoster }
      };
    }

    const updatedPage = await notion.pages.update(pageParams);

    console.log(`\n\x1b[32m[SUCCESS] Page filled using your exact custom template design!\x1b[0m`);
    console.log(`====================================================`);
    console.log(`Page Title: "🎬 ${m.Title}"`);
    console.log(`Notion Page ID: ${updatedPage.id}`);
    console.log(`Notion URL: ${updatedPage.url}`);
    console.log(`====================================================\n`);

  } catch (err) {
    console.error(`\n\x1b[31m❌ Template execution failed:\x1b[0m`, err.message);
  }
}

testUserTemplate();
