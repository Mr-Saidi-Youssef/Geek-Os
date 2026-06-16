const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const parentPageId = '36bd0aaf19d08039b1dffb867c316ea8';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function createDatabase() {
  try {
    console.log('Connecting to Notion API...');
    console.log(`Creating child database "Games" under parent page: ${parentPageId}`);
    
    const db = await notion.databases.create({
      parent: {
        type: 'page_id',
        page_id: parentPageId
      },
      title: [
        {
          type: 'text',
          text: {
            content: 'Games',
            link: null
          }
        }
      ],
      properties: {
        'Title': {
          title: {}
        },
        'Platform': {
          multi_select: {}
        },
        'Genre': {
          multi_select: {}
        },
        'ReleaseYear': {
          number: {
            format: 'number'
          }
        },
        'Metacritic': {
          number: {
            format: 'number'
          }
        },
        'UserScore': {
          number: {
            format: 'number'
          }
        },
        'Developer': {
          rich_text: {}
        },
        'Publisher': {
          rich_text: {}
        },
        'Synopsis': {
          rich_text: {}
        },
        'Cover': {
          files: {}
        },
        'Status': {
          select: {
            options: [
              { name: 'Inbox', color: 'blue' },
              { name: 'Plan to Play', color: 'gray' },
              { name: 'Playing', color: 'yellow' },
              { name: 'Completed', color: 'green' }
            ]
          }
        }
      }
    });
    
    const newDbId = db.id.replace(/-/g, '');
    console.log('\n\x1b[32m✔ Games Database created successfully!\x1b[0m');
    console.log(`Database ID: \x1b[36m${db.id}\x1b[0m (Canonical: \x1b[36m${newDbId}\x1b[0m)`);
    console.log(`URL: ${db.url}`);
    
    // Append to .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes('NOTION_GAMES_DATABASE_ID')) {
      // Replace existing
      envContent = envContent.replace(/NOTION_GAMES_DATABASE_ID=.*/g, `NOTION_GAMES_DATABASE_ID=${newDbId}`);
      console.log('Updated NOTION_GAMES_DATABASE_ID in .env file.');
    } else {
      // Append to the end
      if (!envContent.endsWith('\n')) envContent += '\n';
      envContent += `NOTION_GAMES_DATABASE_ID=${newDbId}\n`;
      console.log('Appended NOTION_GAMES_DATABASE_ID to .env file.');
    }
    
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✔ Environment file updated successfully.');
    
  } catch (err) {
    console.error('\x1b[31mError creating database:\x1b[0m', err.message);
    if (err.body) {
      console.error('Details:', err.body);
    }
  }
}

createDatabase();
