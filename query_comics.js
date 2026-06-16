const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = '371d0aaf-19d0-81c5-9b14-fbc0c52b0040';

async function start() {
  try {
    const res = await notion.databases.query({
      database_id: DATABASE_ID,
    });
    console.log('Query results count:', res.results.length);
    for (const p of res.results) {
      const title = p.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
      const cover = p.cover?.external?.url || 'No Cover';
      console.log(`- Page: "${title}" | ID: ${p.id} | Cover: ${cover}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

start();
