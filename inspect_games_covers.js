const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf19d0815bb5d3d51ed587a7d1';

const targetGames = [
  'Disaster: Day of Crisis',
  'Looney Tunes: Sheep Raider',
  'Nickelodeon Barnyard',
  'Zax: The Alien Hunter',
  'Blast Corps',
  'One Piece: Unlimited Adventure',
  'Star Wars: The Force Unleashed II'
];

async function inspect() {
  console.log('Searching for target games in Notion Games database...');
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        or: targetGames.map(title => ({
          property: 'Title',
          title: { equals: title }
        }))
      }
    });

    console.log(`Found ${response.results.length} matching games in Notion:\n`);
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
      console.log(`Page Cover:`, cover ? JSON.stringify(cover, null, 2) : 'None');
      
      const coverProp = page.properties['Cover'];
      console.log(`Cover Property Column:`, coverProp ? JSON.stringify(coverProp, null, 2) : 'None');
      console.log('----------------------------------------------------');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspect();
