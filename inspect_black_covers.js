const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MOVIE_DB_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const TV_DB_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';

const notion = new Client({ auth: NOTION_TOKEN });

const TARGETS = [
  "Taylor Swift: The 1989 World Tour - Live",
  "Kill Bill: The Whole Bloody Affair",
  "Goodfellas"
];

async function inspect(dbId, name) {
  console.log(`\nChecking in ${name} database...`);
  for (const title of TARGETS) {
    try {
      const response = await notion.databases.query({
        database_id: dbId,
        filter: {
          property: 'Title',
          title: {
            equals: title
          }
        }
      });
      
      if (response.results.length > 0) {
        response.results.forEach(page => {
          console.log(`Found "${title}":`);
          console.log(`  Page ID: ${page.id}`);
          console.log(`  Cover Object:`, JSON.stringify(page.cover, null, 2));
        });
      } else {
        console.log(`  "${title}" not found.`);
      }
    } catch (err) {
      console.error(`  Error querying "${title}":`, err.message);
    }
  }
}

async function run() {
  await inspect(MOVIE_DB_ID, 'Movie Library');
  await inspect(TV_DB_ID, 'TV Series');
}

run();
