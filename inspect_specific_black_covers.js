const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';

const targetTitles = [
  'Green Paradise',
  'Harmony with A R Rahman',
  'Nature\'s Power Revealed',
  'Peasants Rebellion',
  'Fresh Tracks'
];

async function inspect() {
  console.log('Searching for target series in Notion...');
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        or: targetTitles.map(title => ({
          property: 'Title',
          title: {
            equals: title
          }
        }))
      }
    });

    console.log(`Found ${response.results.length} matching pages in Notion:\n`);
    for (const page of response.results) {
      let title = '';
      for (const key of Object.keys(page.properties)) {
        if (page.properties[key].type === 'title') {
          title = page.properties[key].title[0]?.plain_text || 'Untitled';
          break;
        }
      }

      console.log(`Title: "${title}"`);
      console.log(`Page ID: ${page.id}`);
      
      const cover = page.cover;
      console.log(`Cover:`, cover ? JSON.stringify(cover, null, 2) : 'None');
      
      // Let's also check if there is a cover property column
      const coverProp = page.properties['Cover'] || page.properties['Cover Image'];
      console.log(`Cover Property Column:`, coverProp ? JSON.stringify(coverProp, null, 2) : 'None');
      console.log('----------------------------------------------------');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspect();
