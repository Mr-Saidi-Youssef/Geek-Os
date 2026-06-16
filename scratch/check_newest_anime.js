const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = '36dd0aaf19d0800792e7dca0434c570c';

async function run() {
  try {
    const res = await notion.databases.query({
      database_id: DB_ID,
      page_size: 5
    });
    console.log(`Found ${res.results.length} pages in Anime DB:`);
    for (const page of res.results) {
      const title = page.properties?.Title?.title?.map(x => x.plain_text).join('') ||
                    page.properties?.Name?.title?.map(x => x.plain_text).join('') || '(Untitled)';
      console.log(`- "${title}" | ID: ${page.id}`);
    }
  } catch (err) {
    console.error(err.message);
  }
}

run();
