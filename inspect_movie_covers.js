const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MOVIE_DB_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';

const notion = new Client({ auth: NOTION_TOKEN });

async function inspectUrls() {
  console.log('Querying first 30 movies to inspect cover URLs...');
  try {
    const response = await notion.databases.query({
      database_id: MOVIE_DB_ID,
      page_size: 30,
    });

    response.results.forEach((page, idx) => {
      let title = '';
      for (const key of Object.keys(page.properties)) {
        const prop = page.properties[key];
        if (prop.type === 'title' && prop.title && prop.title.length > 0) {
          title = prop.title[0].plain_text;
          break;
        }
      }
      const coverUrl = page.cover ? (page.cover.external ? page.cover.external.url : 'no external url') : 'null';
      console.log(`[${idx + 1}] "${title}": cover = ${coverUrl}`);
    });
  } catch (e) {
    console.error('Error:', e.message);
  }
}

inspectUrls();
