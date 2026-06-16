const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const parentPageId = '36bd0aaf19d0808ca81ec4247c9d32c8';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function createDatabase() {
  try {
    console.log('Connecting to Notion API...');
    console.log(`Creating child database "Manga Library" under parent page: ${parentPageId}`);
    
    const db = await notion.databases.create({
      parent: {
        type: 'page_id',
        page_id: parentPageId
      },
      title: [
        {
          type: 'text',
          text: {
            content: 'Manga Library',
            link: null
          }
        }
      ],
      properties: {
        'Title': {
          title: {}
        },
        'MAL ID': {
          number: {
            format: 'number'
          }
        },
        'MAL Score': {
          number: {
            format: 'number'
          }
        },
        'MAL URL': {
          url: {}
        },
        'Chapters': {
          number: {
            format: 'number'
          }
        },
        'Volumes': {
          number: {
            format: 'number'
          }
        },
        'PublishingStatus': {
          select: {
            options: [
              { name: 'Publishing', color: 'blue' },
              { name: 'Finished', color: 'green' },
              { name: 'On Hiatus', color: 'orange' },
              { name: 'Discontinued', color: 'red' },
              { name: 'Not yet published', color: 'gray' }
            ]
          }
        },
        'Authors': {
          rich_text: {}
        },
        'Genres': {
          multi_select: {}
        },
        'Synopsis': {
          rich_text: {}
        },
        'Cover Image': {
          files: {}
        },
        'Status': {
          status: {}
        }
      }
    });
    
    const newDbId = db.id.replace(/-/g, '');
    console.log('\n\x1b[32m✔ Manga Library Database created successfully!\x1b[0m');
    console.log(`Database ID: \x1b[36m${db.id}\x1b[0m (Canonical: \x1b[36m${newDbId}\x1b[0m)`);
    console.log(`URL: ${db.url}`);
    
    // Append to .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes('NOTION_MANGA_DATABASE_ID')) {
      // Replace existing
      envContent = envContent.replace(/NOTION_MANGA_DATABASE_ID=.*/g, `NOTION_MANGA_DATABASE_ID=${newDbId}`);
      console.log('Updated NOTION_MANGA_DATABASE_ID in .env file.');
    } else {
      // Append to the end
      if (!envContent.endsWith('\n')) envContent += '\n';
      envContent += `NOTION_MANGA_DATABASE_ID=${newDbId}\n`;
      console.log('Appended NOTION_MANGA_DATABASE_ID to .env file.');
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
