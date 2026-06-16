const { Client } = require('@notionhq/client');
require('dotenv').config({ path: 'd:/Work/Second Brain/Projects/Products/Watchlist Tracker/Package/.env' });

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';

async function run() {
  try {
    const queryRes = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'Title',
        title: {
          contains: 'Oldeuboi'
        }
      }
    });

    if (queryRes.results.length === 0) {
      console.log('No page found for "Oldeuboi". Trying "Oldboy"...');
      const queryRes2 = await notion.databases.query({
        database_id: DATABASE_ID,
        filter: {
          property: 'Title',
          title: {
            contains: 'Oldboy'
          }
        }
      });
      if (queryRes2.results.length === 0) {
        console.log('No page found for "Oldboy" either.');
        return;
      }
      const page = queryRes2.results[0];
      console.log(`Found Page: "${page.properties.Title.title[0]?.plain_text}", ID: "${page.id}"`);
      await inspectBlocks(page.id);
    } else {
      const page = queryRes.results[0];
      console.log(`Found Page: "${page.properties.Title.title[0]?.plain_text}", ID: "${page.id}"`);
      await inspectBlocks(page.id);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function inspectBlocks(pageId) {
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  console.log(`Page has ${blocks.results.length} blocks.`);
  blocks.results.forEach((block, index) => {
    console.log(`${index + 1}. Block ID: "${block.id}", Type: "${block.type}"`);
  });
}

run();
