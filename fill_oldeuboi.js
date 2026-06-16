const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PAGE_ID = '36dd0aaf-19d0-81f5-b782-fc4ff99de443'; // The page "Oldeuboi"

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

async function run() {
  console.log(`\n====================================================`);
  console.log(`🎬 FULLY AUTOMATED TEMPLATE CREATION: "Oldboy (2003)"`);
  console.log(`====================================================\n`);

  try {
    // 1. Fetch metadata from OMDb using the original English title "Oldboy"
    console.log(`[1/5] Fetching metadata from OMDb for "Oldboy"...`);
    const omdbRes = await axios.get(`http://www.omdbapi.com/?t=Oldboy&y=2003&type=movie&apikey=thewdb`);
    const m = omdbRes.data;

    if (m.Response === 'False') {
      throw new Error(`Movie not found in OMDb: ${m.Error}`);
    }
    console.log(`      Found: "${m.Title}" (${m.Year}) by ${m.Director}`);

    // 2. Fetch YouTube trailer URL keylessly
    console.log(`[2/5] Scoping YouTube for official trailer...`);
    const trailerUrl = await getYoutubeTrailer(m.Title, m.Year) || 'https://www.youtube.com/watch?v=2HkjrJ6IK5E';
    console.log(`      Trailer found: ${trailerUrl}`);

    // 3. Prepare cover image
    const rawPoster = m.Poster !== 'N/A' ? m.Poster : '';
    let highResPoster = getHighResPoster(rawPoster);
    if (highResPoster) {
      highResPoster = `https://images.weserv.nl/?url=${encodeURIComponent(highResPoster)}`;
    }

    // 4. Construct block structures programmatically matching their design
    console.log(`[3/5] Constructing page body blocks matching template...`);

    // A. Synopsis Callout Block (empty main text, info icon, gray background)
    const calloutBlock = {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [],
        icon: {
          type: 'icon',
          icon: { name: 'info-alternate', color: 'gray' }
        },
        color: 'gray_background'
      }
    };

    // B. Other layout blocks
    const otherBlocks = [
      // H2 Trailer
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Trailer' } }],
          color: 'gray_background'
        }
      },
      // Native interactive Video Embed block!
      {
        object: 'block',
        type: 'video',
        video: {
          external: { url: trailerUrl }
        }
      },
      // H2 Cast & Crew
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Cast & Crew' } }],
          color: 'gray_background'
        }
      },
      // Director bullet
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: 'Director: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: m.Director } }
          ]
        }
      },
      // Starring bullet
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: 'Starring: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: m.Actors } }
          ]
        }
      },
      // Writer bullet
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: m.Writer } }
          ]
        }
      },
      // Divider
      {
        object: 'block',
        type: 'divider',
        divider: {}
      },
      // My Review H2
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'My Review' } }],
          color: 'gray_background'
        }
      },
      // My Review Callout box
      {
        object: 'block',
        type: 'callout',
        callout: {
          rich_text: [
            { type: 'text', text: { content: 'Watched on: ' }, annotations: { bold: true } }
          ],
          icon: {
            type: 'icon',
            icon: { name: 'pencil', color: 'gray' }
          },
          color: 'gray_background'
        }
      },
      // Quotes & Moments H2
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Quotes & Moments' } }],
          color: 'gray_background'
        }
      },
      // Notes H2
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Notes' } }],
          color: 'gray_background'
        }
      }
    ];

    console.log(`[4/5] Appending blocks to the empty "Oldeuboi" page body...`);
    
    // 1. Append the Synopsis Callout block first
    const calloutRes = await notion.blocks.children.append({
      block_id: PAGE_ID,
      children: [calloutBlock]
    });
    const newCalloutId = calloutRes.results[0].id;

    // 2. Append the nested heading and paragraph inside the Synopsis Callout box!
    const nestedBlocks = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Synopsis' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: m.Plot } }]
        }
      }
    ];

    await notion.blocks.children.append({
      block_id: newCalloutId,
      children: nestedBlocks
    });

    // 3. Append all the other blocks (Trailer, Cast/Crew, review structure) below it
    await notion.blocks.children.append({
      block_id: PAGE_ID,
      children: otherBlocks
    });

    console.log(`      ✓ Replicated layout blocks and filled synopsis / trailer player perfectly.`);

    // 5. Update database properties & cover poster
    console.log(`[5/5] Updating database properties and cover poster...`);
    const pageProperties = {
      'Title': {
        title: [{ text: { content: 'Oldboy' } }] // Set title to standard English "Oldboy"
      },
      'Director': {
        rich_text: [{ text: { content: m.Director } }]
      },
      'ReleaseYear': {
        number: parseInt(m.Year, 10) || 2003
      },
      'Runtime': {
        number: parseInt(m.Runtime.replace(' min', ''), 10) || 120
      },
      'IMDbRating': {
        number: parseFloat(m.imdbRating) || 8.4
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
      page_id: PAGE_ID,
      properties: pageProperties
    };

    if (highResPoster) {
      pageParams.cover = {
        type: 'external',
        external: { url: highResPoster }
      };
    }

    await notion.pages.update(pageParams);

    console.log(`\n\x1b[32m[SUCCESS] Oldboy (2003) successfully generated completely programmatically!\x1b[0m`);
    console.log(`====================================================`);
    console.log(`Page Title: "Oldboy"`);
    console.log(`Notion Page ID: ${PAGE_ID}`);
    console.log(`Notion URL: https://www.notion.so/Oldboy-36dd0aaf19d081f5b782fc4ff99de443`);
    console.log(`====================================================\n`);

  } catch (err) {
    console.error(`\n\x1b[31m❌ Template execution failed:\x1b[0m`, err.message);
  }
}

run();
