const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '371d0aaf19d081c59b14fbc0c52b0040';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function addProperty(retries = 5, delayMs = 5000) {
  try {
    console.log('Adding "Community Rating" property to the Comics database...');
    const response = await notion.databases.update({
      database_id: DATABASE_ID,
      properties: {
        'Community Rating': {
          number: {
            format: 'number'
          }
        }
      }
    });
    console.log('Property successfully added!');
    console.log('Database Properties now include:', Object.keys(response.properties));
  } catch (error) {
    if ((error.status === 429 || error.message?.includes('429')) && retries > 0) {
      console.warn(`Rate limited. Waiting ${delayMs}ms before retry...`);
      await sleep(delayMs);
      return addProperty(retries - 1, delayMs * 2);
    }
    console.error('Error adding property:', error.message);
  }
}

addProperty();
