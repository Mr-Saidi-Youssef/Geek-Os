const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '371d0aaf19d081c59b14fbc0c52b0040';
const notion = new Client({ auth: NOTION_TOKEN });

async function checkDatabaseState() {
  const response = await notion.databases.query({ database_id: DATABASE_ID, page_size: 100 });
  console.log(`Total items in Comics database: ${response.results.length}`);
  
  let enrichedCount = 0;
  let emptyCount = 0;
  
  for (const page of response.results) {
    const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
    if (title === 'New Comics') continue;
    
    // Check if page has blocks (inspecting children)
    const blockRes = await notion.blocks.children.list({ block_id: page.id, page_size: 1 });
    const hasBlocks = blockRes.results.length > 0;
    
    if (hasBlocks) {
      enrichedCount++;
      console.log(`Page: "${title}" - ENRICHED`);
    } else {
      emptyCount++;
      console.log(`Page: "${title}" - EMPTY`);
    }
  }
  
  console.log(`\nSummary: Enriched: ${enrichedCount}, Empty: ${emptyCount}`);
}

checkDatabaseState();
