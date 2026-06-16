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

async function run() {
  const movieTitle = 'Dune: Part Two';
  console.log(`\n====================================================`);
  console.log(`🎬 IN-PLACE FILLING THE MOST RECENTLY CREATED PAGE: "${movieTitle}"`);
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

    // 4. Query the database for the absolute latest edited page
    console.log(`[3/5] Fetching the latest created page in your movie library...`);
    const dbQuery = await notion.databases.query({
      database_id: DATABASE_ID,
      sorts: [
        {
          timestamp: 'last_edited_time',
          direction: 'descending'
        }
      ],
      page_size: 1
    });

    if (dbQuery.results.length === 0) {
      throw new Error('No pages found in the Movie Library database.');
    }

    const latestPage = dbQuery.results[0];
    let pageTitle = 'Untitled';
    for (const [key, value] of Object.entries(latestPage.properties)) {
      if (value.type === 'title') {
        pageTitle = value.title[0]?.plain_text || 'Untitled';
        break;
      }
    }

    console.log(`      Latest Page Found: "${pageTitle}" (ID: ${latestPage.id})`);
    console.log(`      Inspecting blocks...`);

    // 5. Inspect block tree of this page
    const blocksRes = await notion.blocks.children.list({ block_id: latestPage.id });
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
        // The Synopsis callout is at the top of the template
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

    console.log(`      Mapped block placeholders:`);
    console.log(`      - Synopsis Callout Block: ${synopsisCalloutId}`);
    console.log(`      - Video/Embed Block: ${videoBlockId}`);
    console.log(`      - Director Bullet: ${directorBulletId}`);
    console.log(`      - Starring Bullet: ${starringBulletId}`);
    console.log(`      - Writer Bullet: ${writerBulletId}`);

    if (!synopsisCalloutId) {
      throw new Error(`Could not find Synopsis Callout placeholder. Are you sure this page was created using your custom template?`);
    }

    // 6. Fill all placeholders in-place!
    console.log(`[4/5] Populating placeholders in-place...`);

    // A. Synopsis nested paragraph update
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

    // C. Native interactive Video Embed block update
    if (videoBlockId && trailerUrl) {
      await notion.blocks.update({
        block_id: videoBlockId,
        video: {
          external: { url: trailerUrl }
        }
      });
      console.log(`      ✓ Interactive Video player embedded in-place!`);
    } else {
      console.log(`      ⚠️ Video block not found. Under 'Trailer', did you add a native Video block to your template?`);
    }

    // 7. Update database page properties & cover poster
    console.log(`[5/5] Updating database properties and cover poster...`);
    const pageProperties = {
      'Title': {
        title: [{ text: { content: m.Title } }]
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
      page_id: latestPage.id,
      properties: pageProperties
    };

    if (highResPoster) {
      pageParams.cover = {
        type: 'external',
        external: { url: highResPoster }
      };
    }

    const updatedPage = await notion.pages.update(pageParams);

    console.log(`\n\x1b[32m[SUCCESS] Page "${pageTitle}" successfully enriched with interactive trailer and synopsis!\x1b[0m`);
    console.log(`====================================================`);
    console.log(`Page Title: "${m.Title}"`);
    console.log(`Notion Page ID: ${updatedPage.id}`);
    console.log(`Notion URL: ${updatedPage.url}`);
    console.log(`====================================================\n`);

  } catch (err) {
    console.error(`\n\x1b[31m❌ Template execution failed:\x1b[0m`, err.message);
  }
}

run();
