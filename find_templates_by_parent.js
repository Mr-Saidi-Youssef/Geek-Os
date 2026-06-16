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

async function run() {
  console.log('Searching for template pages by parent database matching...');
  const resolvedTemplates = {};
  
  let cursor;
  for (let page = 0; page < 10; page++) {
    try {
      const res = await notion.search({
        query: 'New',
        filter: { value: 'page', property: 'object' },
        start_cursor: cursor,
        page_size: 100
      });
      
      for (const p of res.results) {
        const parentDbId = p.parent?.database_id?.replace(/-/g, '');
        if (parentDbId) {
          for (const [dbName, dbId] of Object.entries(databases)) {
            if (parentDbId === dbId) {
              const title = p.properties?.Title?.title?.map(x => x.plain_text).join('') ||
                            p.properties?.Name?.title?.map(x => x.plain_text).join('') || '(Untitled)';
              console.log(`Found Template Candidate in "${dbName}": "${title}" | ID: ${p.id} | Parent: ${p.parent.database_id}`);
              resolvedTemplates[dbName] = { id: p.id, title: title };
            }
          }
        }
      }
      
      if (!res.next_cursor) break;
      cursor = res.next_cursor;
      await sleep(500);
    } catch (err) {
      console.error('Search error:', err.message);
      break;
    }
  }
  
  console.log('\nResolved Templates Summary:');
  console.log(JSON.stringify(resolvedTemplates, null, 2));
}

run();
