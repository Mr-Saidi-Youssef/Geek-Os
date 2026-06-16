const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const MASTER_TEMPLATE_ID = '370d0aaf-19d0-80b5-945e-df3f03ca5f51'; // Master template block source

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
  console.log(`🎬 LOCATING AND ENRICHING EXISTING MOVIE: "${movieTitle}"`);
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
    const trailerUrl = await getYoutubeTrailer(m.Title, m.Year) || 'https://www.youtube.com/watch?v=Way9Dexny3w';
    console.log(`      Trailer found: ${trailerUrl}`);

    // 3. Prepare high-resolution cover
    const rawPoster = m.Poster !== 'N/A' ? m.Poster : '';
    let highResPoster = getHighResPoster(rawPoster);
    if (highResPoster) {
      highResPoster = `https://images.weserv.nl/?url=${encodeURIComponent(highResPoster)}`;
    }

    // 4. Query database for existing "Dune: Part Two" page
    console.log(`[3/5] Querying Notion for existing page titled "${movieTitle}"...`);
    const queryRes = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'Title', // Let's check Title or Name property
        title: {
          contains: movieTitle
        }
      }
    });

    if (queryRes.results.length === 0) {
      throw new Error(`Could not find an existing page with title containing "${movieTitle}" in the database.`);
    }

    const page = queryRes.results[0];
    console.log(`      Found existing page! ID: ${page.id}, URL: ${page.url}`);

    // 5. Check block children on this existing page
    console.log(`      Retrieving page block children...`);
    const blocksRes = await notion.blocks.children.list({ block_id: page.id });
    const blocks = blocksRes.results;
    console.log(`      Found ${blocks.length} blocks on the page.`);

    let synopsisCalloutId = null;
    let videoBlockId = null;
    let directorBulletId = null;
    let starringBulletId = null;
    let writerBulletId = null;

    // Scan blocks for placeholders if template was already applied
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

    // 6. If the page is blank (no blocks), copy blocks from the master template
    if (!synopsisCalloutId && blocks.length === 0) {
      console.log(`[4/5] Page is currently blank. Copying template layout from master template...`);
      const masterBlocksRes = await notion.blocks.children.list({ block_id: MASTER_TEMPLATE_ID });
      const masterBlocks = masterBlocksRes.results;

      const cleanedChildren = [];
      for (const block of masterBlocks) {
        // Skip child databases as the API blocks creation of these types
        if (block.type === 'child_database') {
          continue;
        }

        const newBlock = {
          object: 'block',
          type: block.type,
          [block.type]: { ...block[block.type] }
        };

        // Clean up unsupported null icon fields that Notion API rejects on creation
        if (newBlock[block.type] && newBlock[block.type].icon === null) {
          delete newBlock[block.type].icon;
        }

        // Inject dynamic values during copy to save API calls!
        if (block.type === 'callout') {
          const text = block.callout.rich_text.map(t => t.plain_text).join('');
          if (!text.includes('Watched')) {
            // Keep block children but clear the outer text
            newBlock.callout.rich_text = [];
          }
        } else if (block.type === 'bulleted_list_item') {
          const text = block.bulleted_list_item.rich_text.map(t => t.plain_text).join('');
          if (text.startsWith('Director:')) {
            newBlock.bulleted_list_item.rich_text = [
              { type: 'text', text: { content: 'Director: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: m.Director } }
            ];
          } else if (text.startsWith('Starring:')) {
            newBlock.bulleted_list_item.rich_text = [
              { type: 'text', text: { content: 'Starring: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: m.Actors } }
            ];
          } else if (text.startsWith('Writer:')) {
            newBlock.bulleted_list_item.rich_text = [
              { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } },
              { type: 'text', text: { content: m.Writer } }
            ];
          }
        } else if (block.type === 'video' && trailerUrl) {
          newBlock.video = {
            external: { url: trailerUrl }
          };
        }

        cleanedChildren.push(newBlock);
      }

      console.log(`      Appending ${cleanedChildren.length} template blocks to page body...`);
      await notion.blocks.children.append({
        block_id: page.id,
        children: cleanedChildren
      });

      // Now query again to find the newly appended synopsis callout and fill its nested paragraph!
      const reFetchedBlocks = await notion.blocks.children.list({ block_id: page.id });
      const newCallout = reFetchedBlocks.results.find(b => b.type === 'callout');
      if (newCallout) {
        const calloutChildren = await notion.blocks.children.list({ block_id: newCallout.id });
        const nestedParagraph = calloutChildren.results.find(b => b.type === 'paragraph');
        if (nestedParagraph) {
          await notion.blocks.update({
            block_id: nestedParagraph.id,
            paragraph: {
              rich_text: [{ type: 'text', text: { content: m.Plot } }]
            }
          });
        }
      }
      console.log(`      ✓ Layout copied and synopsis filled inside Callout box.`);

    } else if (synopsisCalloutId) {
      // 7. If the template is already applied, enrich the placeholders in-place!
      console.log(`[4/5] Template is already applied to this page. Populating in-place...`);

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
        console.log(`      ✓ Interactive Video player embedded in-place!`);
      }
    }

    // 8. Update database properties & cover poster
    console.log(`[5/5] Updating database properties and cover poster...`);
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

    console.log(`\n\x1b[32m[SUCCESS] Existing page for "${m.Title}" successfully enriched!\x1b[0m`);
    console.log(`====================================================`);
    console.log(`Page Title: "${m.Title}"`);
    console.log(`Notion Page ID: ${page.id}`);
    console.log(`Notion URL: ${page.url}`);
    console.log(`====================================================\n`);

  } catch (err) {
    console.error(`\n\x1b[31m❌ Template execution failed:\x1b[0m`, err.message);
  }
}

run();
