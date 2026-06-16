const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const databases = {
  Movies: '7ab340245e7e4b22a3685608e103c0aa',
  Series: '36dd0aaf19d08123893fcbaf9bff624a',
  Anime: '36dd0aaf19d0800792e7dca0434c570c',
  Manga: '370d0aaf19d08121a36ff3dfcc914532',
  Comics: '371d0aaf19d081c59b14fbc0c52b0040',
  Games: '36fd0aaf19d0815bb5d3d51ed587a7d1',
  Books: '8b2780bfd84442d8bcd95223152c0ece'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function findExactTemplateInDb(dbName, dbId) {
  try {
    const res = await notion.databases.query({
      database_id: dbId,
      page_size: 100
    });
    
    for (const page of res.results) {
      const title = page.properties?.Title?.title?.map(x => x.plain_text).join('') ||
                    page.properties?.Name?.title?.map(x => x.plain_text).join('') || '';
      
      const clean = title.trim().toLowerCase();
      if (clean.startsWith('new ') || clean.startsWith('🎬 new ')) {
        console.log(`Matched Template in "${dbName}": "${title}" | ID: ${page.id}`);
        return { id: page.id, title: title };
      }
    }
  } catch (err) {
    console.error(`Error querying "${dbName}":`, err.message);
  }
  return null;
}

async function run() {
  console.log('Scanning databases directly for template pages...\n');
  const results = {};
  for (const [dbName, dbId] of Object.entries(databases)) {
    const template = await findExactTemplateInDb(dbName, dbId);
    if (template) {
      results[dbName] = template;
    }
    await sleep(400);
  }
  console.log('\nFINAL TEMPLATES SUMMARY:');
  console.log(JSON.stringify(results, null, 2));
}

run();
