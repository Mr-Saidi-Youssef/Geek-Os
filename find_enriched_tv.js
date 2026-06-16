const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = '36dd0aaf19d08123893fcbaf9bff624a';

async function findEnriched() {
  console.log('Querying TV database for pages with content...');
  try {
    const res = await notion.databases.query({ database_id: DB_ID, page_size: 50 });
    console.log(`Fetched ${res.results.length} pages.`);
    for (const page of res.results) {
      const title = Object.values(page.properties).find(p => p.type === 'title')?.title?.map(t => t.plain_text).join('') || 'Untitled';
      const blocks = await notion.blocks.children.list({ block_id: page.id, page_size: 1 });
      if (blocks.results.length > 0) {
        console.log(`FOUND enriched TV page: "${title}" (ID: ${page.id})`);
      }
    }
    console.log('Search complete.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

findEnriched();
