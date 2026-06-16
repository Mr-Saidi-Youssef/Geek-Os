/**
 * find_missing_series_covers.js
 * Scans the Notion TV Series database for missing covers
 * and outputs the first 100 titles to help diagnose the issue.
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TV_DB_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';

if (!NOTION_TOKEN) {
  console.error('Error: NOTION_TOKEN is not set.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

async function run() {
  console.log('🔍 Scanning TV Series database for missing covers...');
  
  let missing = [];
  let processed = 0;
  let hasMore = true;
  let startCursor = undefined;
  
  try {
    while (hasMore && missing.length < 100) {
      const response = await notion.databases.query({
        database_id: TV_DB_ID,
        start_cursor: startCursor,
        page_size: 100
      });
      
      for (const page of response.results) {
        processed++;
        let title = '';
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            title = prop.title[0].plain_text;
            break;
          }
        }
        
        const cover = page.cover;
        const coverUrl = cover && cover.external ? cover.external.url : '';
        
        let isPlaceholder = false;
        if (coverUrl) {
          const url = coverUrl.toLowerCase();
          if (url.includes('nophoto') || url.includes('placeholder') || url.includes('nocover') || url.includes('111x148')) {
            isPlaceholder = true;
          }
        }
        
        if (!coverUrl || isPlaceholder) {
          missing.push({
            id: page.id,
            title: title || 'Unnamed Series',
            coverUrl: coverUrl || '[No Cover]'
          });
        }
      }
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
    
    console.log(`\nScan completed. Checked ${processed} total cards.`);
    console.log(`Found ${missing.length} series missing covers:`);
    console.log('====================================================');
    missing.forEach((item, idx) => {
      console.log(`[${idx + 1}] "${item.title}" (Cover State: ${item.coverUrl})`);
    });
    console.log('====================================================');
    
  } catch (err) {
    console.error('Error scanning database:', err.message);
  }
}

run();
