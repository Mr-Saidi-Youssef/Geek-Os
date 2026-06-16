const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log('Fetching all pages in the workspace directly...');
  let cursor;
  let allPages = [];
  
  for (let page = 0; page < 8; page++) {
    try {
      const res = await notion.search({
        filter: { value: 'page', property: 'object' },
        start_cursor: cursor,
        page_size: 100
      });
      allPages.push(...res.results);
      if (!res.next_cursor) break;
      cursor = res.next_cursor;
      await sleep(400);
    } catch (err) {
      console.error('Error fetching pages:', err.message);
      break;
    }
  }
  
  console.log(`\nFound ${allPages.length} total pages. Filtering for dashboard page candidates:`);
  for (const p of allPages) {
    const title = p.properties?.title?.title?.map(x => x.plain_text).join('') ||
                  p.properties?.Name?.title?.map(x => x.plain_text).join('') || '';
    
    const clean = title.trim();
    if (clean.length > 0 && clean.length < 30) {
      const lower = clean.toLowerCase();
      if (lower.includes('series') || lower.includes('comic') || lower.includes('game') || lower.includes('book') || lower.includes('manga') || lower.includes('anime') || lower.includes('movie')) {
        console.log(`- Candidate Page: "${clean}" | ID: ${p.id} | Parent Type: ${p.parent.type} | URL: ${p.url}`);
      }
    }
  }
}

run();
