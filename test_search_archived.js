/**
 * test_search_archived.js
 * Diagnostic script to search for archived pages by title and print details.
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not configured.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function run() {
  const titles = [
    "An American Tail: The Treasure of Manhattan Island",
    "The Last Unicorn",
    "Rugrats In Paris",
    "The Tigger Movie",
    "The Emperor's New Groove"
  ];
  
  for (const title of titles) {
    console.log(`\n🔍 Searching for: "${title}"`);
    try {
      const res = await notion.search({
        query: title,
        filter: {
          property: 'object',
          value: 'page'
        }
      });
      
      console.log(`Found ${res.results.length} results:`);
      res.results.forEach((p, idx) => {
        let pageTitle = '';
        for (const prop of Object.values(p.properties)) {
          if (prop.type === 'title' && prop.title?.length > 0) {
            pageTitle = prop.title[0].plain_text;
            break;
          }
        }
        console.log(`  [${idx + 1}] ID: ${p.id}`);
        console.log(`      Title: "${pageTitle}"`);
        console.log(`      Archived: ${p.archived}`);
        console.log(`      Parent Type: ${p.parent?.type}`);
        console.log(`      Parent ID: ${p.parent?.database_id || p.parent?.page_id}`);
      });
    } catch (e) {
      console.error('Error:', e.message);
    }
  }
}

run();
