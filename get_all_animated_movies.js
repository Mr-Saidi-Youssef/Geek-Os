const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MOVIE_DB_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';

const notion = new Client({ auth: NOTION_TOKEN });

async function run() {
  console.log('Querying all animated movies from Movie Library...');
  let hasMore = true;
  let startCursor = undefined;
  let titles = [];

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: MOVIE_DB_ID,
        start_cursor: startCursor,
        page_size: 100,
        filter: {
          property: 'Genre',
          multi_select: {
            contains: 'Animation'
          }
        }
      });

      for (const page of response.results) {
        let titleVal = '';
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            titleVal = prop.title[0].plain_text;
            break;
          }
        }
        if (titleVal) {
          titles.push({ id: page.id, title: titleVal });
        }
      }
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`\nFound ${titles.length} active animated movies:`);
    titles.forEach((t, idx) => {
      console.log(`[${idx + 1}] "${t.title}" (ID: ${t.id})`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

run();
