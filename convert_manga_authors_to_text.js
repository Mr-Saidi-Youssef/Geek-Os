const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = '370d0aaf19d08121a36ff3dfcc914532';

async function run() {
  console.log('====================================================');
  console.log('🔄 CONVERTING MANGA AUTHORS PROPERTY TO RICH TEXT');
  console.log('====================================================\n');

  try {
    console.log('Sending database schema update request to Notion...');
    const response = await notion.databases.update({
      database_id: DB_ID,
      properties: {
        'Authors': {
          rich_text: {}
        }
      }
    });

    console.log('\x1b[32m✔ SUCCESS! Authors property converted to rich_text.\x1b[0m');
    console.log('New Authors property definition:', JSON.stringify(response.properties['Authors'], null, 2));

  } catch (err) {
    console.error('\x1b[31m✘ Failed to convert Authors property:\x1b[0m', err.message);
    if (err.body) {
      console.error(err.body);
    }
  }
}

run();
