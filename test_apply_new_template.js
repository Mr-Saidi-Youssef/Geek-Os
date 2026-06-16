const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TARGET_PAGE_ID = '370d0aaf-19d0-80b5-945e-df3f03ca5f51'; // The new template page

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

async function fillTemplateDirectly() {
  const movieTitle = 'Inception';
  console.log(`\n====================================================`);
  console.log(`🎬 IN-PLACE FILLING YOUR NEW TEMPLATE WITH: "${movieTitle}"`);
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
    console.log(`      Found: "${m.Title}" (${m.Year})`);

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

    // 4. Mapped block IDs based on our block children list
    const synopsisCalloutId = '370d0aaf-19d0-8057-9f3b-e8108493bc47';
    const trailerParagraphId = '370d0aaf-19d0-809b-b4ba-f1a844a44351';
    const directorBulletId = '370d0aaf-19d0-80ca-bff9-f0a442e0aad3';
    const starringBulletId = '370d0aaf-19d0-808a-a6aa-f6f94c54f594';
    const writerBulletId = '370d0aaf-19d0-80cf-8541-e40bccd3802f';

    // 5. Update blocks in-place preserving your exact template blocks
    console.log(`[3/5] Updating placeholder blocks in-place...`);

    // A. Synopsis Callout text update (keeping your info-alternate gray icon/color)
    await notion.blocks.update({
      block_id: synopsisCalloutId,
      callout: {
        rich_text: [{ type: 'text', text: { content: m.Plot } }]
      }
    });
    console.log(`      ✓ Filled Synopsis Callout.`);

    // B. Cast & Crew bullets update
    await notion.blocks.update({
      block_id: directorBulletId,
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: 'Director: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Director } }
        ]
      }
    });

    await notion.blocks.update({
      block_id: starringBulletId,
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: 'Starring: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Actors } }
        ]
      }
    });

    await notion.blocks.update({
      block_id: writerBulletId,
      bulleted_list_item: {
        rich_text: [
          { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } },
          { type: 'text', text: { content: m.Writer } }
        ]
      }
    });
    console.log(`      ✓ Updated Cast & Crew bullets.`);

    // C. Trailer block update (Updating paragraph with a clickable blue text link)
    if (trailerUrl) {
      await notion.blocks.update({
        block_id: trailerParagraphId,
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: '🎞️ Watch Official Trailer ↗', link: { url: trailerUrl } }, annotations: { bold: true, color: 'blue' } }
          ]
        }
      });
      console.log(`      ✓ Filled Trailer link.`);
    }

    // 6. Update database properties & cover poster
    console.log(`[4/5] Updating database properties and cover poster...`);
    const pageProperties = {
      'Title': {
        title: [{ text: { content: m.Title } }] // Sets title in database
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

    console.log(`\n\x1b[32m[5/5] SUCCESS! New template page populated live!\x1b[0m`);
    console.log(`====================================================`);
    console.log(`Page Title: "${m.Title}"`);
    console.log(`Notion Page ID: ${updatedPage.id}`);
    console.log(`Notion URL: ${updatedPage.url}`);
    console.log(`====================================================\n`);

  } catch (err) {
    console.error(`\n\x1b[31m❌ Template execution failed:\x1b[0m`, err.message);
  }
}

fillTemplateDirectly();
