const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '371d0aaf19d081c59b14fbc0c52b0040';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function checkRatings() {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      page_size: 10
    });
    console.log(`Auditing 10 sample pages in the Comics database:`);
    for (const page of response.results) {
      const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
      const rating = page.properties['Community Rating']?.number;
      const olKey = page.properties['OL Key']?.rich_text?.map(t => t.plain_text).join('');
      console.log(`Page: "${title}" | Rating: ${rating ?? 'N/A'} | OL Key: ${olKey ?? 'N/A'}`);
    }
  } catch (error) {
    console.error('Error querying Comics database:', error);
  }
}

checkRatings();
