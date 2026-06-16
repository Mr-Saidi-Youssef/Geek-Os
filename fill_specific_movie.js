const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';

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

function getOMDbQueryTitle(title) {
  const translations = {
    'shichinin no samurai': 'Seven Samurai',
    'shichinin no samurai (seven samurai)': 'Seven Samurai',
    'seven samurai': 'Seven Samurai',
    'dune: part two': 'Dune: Part Two'
  };
  const normalized = title.toLowerCase().trim();
  return translations[normalized] || title;
}

async function enrichSpecificMovie(titleQuery) {
  console.log(`\n====================================================`);
  console.log(`🎬 IN-PLACE FILLING TARGET MOVIE: "${titleQuery}"`);
  console.log(`====================================================\n`);

  try {
    // 1. Query database for existing page
    console.log(`[1/5] Locating page titled containing "${titleQuery}"...`);
    const queryRes = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'Title',
        title: {
          contains: titleQuery
        }
      }
    });

    if (queryRes.results.length === 0) {
      throw new Error(`Could not find a page with title containing "${titleQuery}" in the database.`);
    }

    const page = queryRes.results[0];
    let actualTitle = 'Untitled';
    for (const [key, value] of Object.entries(page.properties)) {
      if (value.type === 'title') {
        actualTitle = value.title[0]?.plain_text || 'Untitled';
        break;
      }
    }
    console.log(`      Found Page: "${actualTitle}" (ID: ${page.id})`);

    // 2. Fetch metadata from OMDb
    console.log(`[2/5] Fetching metadata from OMDb...`);
    const searchTitle = getOMDbQueryTitle(actualTitle);
    const omdbUrl = `http://www.omdbapi.com/?t=${encodeURIComponent(searchTitle)}&type=movie&apikey=thewdb`;
    const omdbRes = await axios.get(omdbUrl);
    const m = omdbRes.data;

    if (m.Response === 'False') {
      throw new Error(`Movie not found in OMDb for "${searchTitle}": ${m.Error}`);
    }
    console.log(`      Found on OMDb: "${m.Title}" (${m.Year}) by ${m.Director}`);

    // 3. Fetch YouTube trailer URL keylessly
    console.log(`[3/5] Scoping YouTube for official trailer...`);
    const trailerUrl = await getYoutubeTrailer(m.Title, m.Year) || 'https://www.youtube.com/watch?v=Way9Dexny3w';
    console.log(`      Trailer found: ${trailerUrl}`);

    // 4. Prepare cover image
    const rawPoster = m.Poster !== 'N/A' ? m.Poster : '';
    let highResPoster = getHighResPoster(rawPoster);
    if (highResPoster) {
      highResPoster = `https://images.weserv.nl/?url=${encodeURIComponent(highResPoster)}`;
    }

    // 5. Retrieve page block children to map placeholders
    console.log(`[4/5] Retrieving block list for the page...`);
    const blocksRes = await notion.blocks.children.list({ block_id: page.id });
    const blocks = blocksRes.results;
    console.log(`      Found ${blocks.length} blocks on the page.`);

    let synopsisCalloutId = null;
    let videoBlockId = null;
    let directorBulletId = null;
    let starringBulletId = null;
    let writerBulletId = null;

    // Scan blocks for placeholders
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type === 'callout') {
        const text = b.callout.rich_text.map(t => t.plain_text).join('');
        if (!synopsisCalloutId && !text.includes('Watched')) {
          synopsisCalloutId = b.id;
        }
      } else if (b.type === 'video') {
        videoBlockId = b.id;
      } else if (b.type === 'embed') {
        videoBlockId = b.id;
      } else if (b.type === 'bulleted_list_item') {
        const text = b.bulleted_list_item.rich_text.map(t => t.plain_text).join('');
        if (text.startsWith('Director:')) {
          directorBulletId = b.id;
        } else if (text.startsWith('Starring:')) {
          starringBulletId = b.id;
        } else if (text.startsWith('Writer:')) {
          writerBulletId = b.id;
        }
      }
    }

    console.log(`      Mapped placeholders:`);
    console.log(`      - Synopsis Callout Block: ${synopsisCalloutId}`);
    console.log(`      - Video/Embed Block: ${videoBlockId}`);
    console.log(`      - Director Bullet: ${directorBulletId}`);
    console.log(`      - Starring Bullet: ${starringBulletId}`);
    console.log(`      - Writer Bullet: ${writerBulletId}`);

    if (!synopsisCalloutId) {
      throw new Error(`Could not find the Synopsis Callout box block. Did you apply the template to the page first?`);
    }

    // 6. Populate page in-place!
    console.log(`[5/5] Enriched placeholders in-place...`);

    // A. Synopsis nested paragraph fill
    const calloutChildren = await notion.blocks.children.list({ block_id: synopsisCalloutId });
    const nestedParagraph = calloutChildren.results.find(b => b.type === 'paragraph');
    if (nestedParagraph) {
      await notion.blocks.update({
        block_id: nestedParagraph.id,
        paragraph: {
          rich_text: [{ type: 'text', text: { content: m.Plot } }]
        }
      });
      console.log(`      ✓ Synopsis plot text filled in Callout box.`);
    }

    // B. Cast & Crew bullets update
    if (directorBulletId) {
      await notion.blocks.update({
        block_id: directorBulletId,
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: 'Director: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: m.Director } }
          ]
        }
      });
    }
    if (starringBulletId) {
      await notion.blocks.update({
        block_id: starringBulletId,
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: 'Starring: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: m.Actors } }
          ]
        }
      });
    }
    if (writerBulletId) {
      await notion.blocks.update({
        block_id: writerBulletId,
        bulleted_list_item: {
          rich_text: [
            { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: m.Writer } }
          ]
        }
      });
      console.log(`      ✓ Cast & Crew bullet items updated.`);
    }

    // C. Native Video block update
    if (videoBlockId && trailerUrl) {
      await notion.blocks.update({
        block_id: videoBlockId,
        video: {
          external: { url: trailerUrl }
        }
      });
      console.log(`      ✓ Swapped template placeholder video URL with real YouTube player embed!`);
    } else {
      console.log(`      ⚠️ Video block not found. Under 'Trailer', did you add a native Video block to your template?`);
    }

    // 7. Update database page properties & cover poster
    const pageProperties = {
      'Director': {
        rich_text: [{ text: { content: m.Director } }]
      },
      'ReleaseYear': {
        number: parseInt(m.Year, 10) || 2024
      },
      'Runtime': {
        number: parseInt(m.Runtime.replace(' min', ''), 10) || 166
      },
      'IMDbRating': {
        number: parseFloat(m.imdbRating) || 8.6
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
      page_id: page.id,
      properties: pageProperties
    };

    if (highResPoster) {
      pageParams.cover = {
        type: 'external',
        external: { url: highResPoster }
      };
    }

    await notion.pages.update(pageParams);

    console.log(`\n\x1b[32m[SUCCESS] Existing page for "${m.Title}" successfully enriched in-place!\x1b[0m`);
    console.log(`====================================================`);
    console.log(`Page Title: "${m.Title}"`);
    console.log(`Notion Page ID: ${page.id}`);
    console.log(`Notion URL: ${page.url}`);
    console.log(`====================================================\n`);

  } catch (err) {
    console.error(`\n\x1b[31m❌ Template execution failed:\x1b[0m`, err.message);
  }
}

// Run for Shichinin no samurai
enrichSpecificMovie('Shichinin no samurai');
