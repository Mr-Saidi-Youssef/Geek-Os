const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const devNotion = new Client({ auth: NOTION_TOKEN });

const DB_IDS = {
  anime: '36dd0aaf19d0800792e7dca0434c570c',
  manga: '370d0aaf19d08121a36ff3dfcc914532',
  game: '36fd0aaf19d0815bb5d3d51ed587a7d1',
  comic: '371d0aaf-19d0-81c5-9b14-fbc0c52b0040',
  movie: '7ab340245e7e4b22a3685608e103c0aa',
  tv: '36dd0aaf19d08123893fcbaf9bff624a',
  book: '8b2780bfd84442d8bcd95223152c0ece'
};

async function run() {
  for (const [key, id] of Object.entries(DB_IDS)) {
    try {
      const db = await devNotion.databases.retrieve({ database_id: id });
      console.log(`\n=================== ${key.toUpperCase()} (${id}) ===================`);
      console.log(`Title: ${db.title?.map(t => t.plain_text).join('')}`);
      console.log('Properties:');
      for (const [propName, propDesc] of Object.entries(db.properties)) {
        console.log(`  - ${propName}: ${propDesc.type}`);
      }
    } catch (err) {
      console.error(`Failed for ${key}:`, err.message);
    }
  }
}

run();
