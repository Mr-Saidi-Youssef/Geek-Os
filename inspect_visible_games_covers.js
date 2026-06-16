const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf19d0815bb5d3d51ed587a7d1';

const workingGames = [
  'The Escapists',
  'Patapon 2',
  'Samurai Gunn',
  'Rock of Ages'
];

async function inspect() {
  console.log('Searching for working games in Notion Games database...');
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        or: workingGames.map(title => ({
          property: 'Title',
          title: { equals: title }
        }))
      }
    });

    console.log(`Found ${response.results.length} working games in Notion:\n`);
    for (const page of response.results) {
      let title = '';
      for (const key of Object.keys(page.properties)) {
        if (page.properties[key].type === 'title') {
          title = page.properties[key].title[0]?.plain_text || 'Untitled';
          break;
        }
      }

      console.log(`Title: "${title}"`);
      
      const cover = page.cover;
      console.log(`Page Cover URL:`, cover?.external?.url || cover?.file?.url || 'None');
      console.log('----------------------------------------------------');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspect();
