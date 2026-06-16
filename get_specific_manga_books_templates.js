const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const dbManga = '370d0aaf19d08121a36ff3dfcc914532';
const dbBooks = '8b2780bfd84442d8bcd95223152c0ece';

async function scanDb(name, dbId) {
  console.log(`Scanning "${name}" database...`);
  try {
    const res = await notion.databases.query({ database_id: dbId });
    for (const page of res.results) {
      const title = page.properties?.Title?.title?.map(x => x.plain_text).join('') ||
                    page.properties?.Name?.title?.map(x => x.plain_text).join('') || '';
      const clean = title.trim().toLowerCase();
      if (clean.includes('new manga') || clean.includes('new book') || clean.includes('new books') || clean === 'new' || clean === 'template') {
        console.log(`* MATCH * Title: "${title}" | ID: ${page.id}`);
      } else if (clean.startsWith('new ') && clean.length < 15) {
        console.log(`* CANDIDATE * Title: "${title}" | ID: ${page.id}`);
      }
    }
  } catch (err) {
    console.error(`Error scanning ${name}:`, err.message);
  }
}

async function run() {
  await scanDb('Manga', dbManga);
  await sleep(1000);
  await scanDb('Books', dbBooks);
}

run();
