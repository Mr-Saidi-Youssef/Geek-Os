const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '371d0aaf19d081c59b14fbc0c52b0040';
const notion = new Client({ auth: NOTION_TOKEN });

async function audit() {
  const response = await notion.databases.query({ database_id: DATABASE_ID, page_size: 100 });
  let missing = 0, hasCovers = 0;
  for (const page of response.results) {
    const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
    if (title === 'New Comics') continue;
    
    const pageCover = page.cover?.external?.url || page.cover?.file?.url || null;
    const coverProp = page.properties['Cover Image'];
    let coverPropUrl = null;
    if (coverProp?.type === 'files' && coverProp.files.length > 0) {
      const f = coverProp.files[0];
      coverPropUrl = f.external?.url || f.file?.url || null;
    }
    const olKey = page.properties['OL Key']?.rich_text?.map(t => t.plain_text).join('') || null;
    
    if (!pageCover && !coverPropUrl) {
      missing++;
      console.log(`❌ "${title}" — NO cover | OL Key: ${olKey || 'N/A'}`);
    } else {
      hasCovers++;
      console.log(`✅ "${title}" — cover: ${pageCover || coverPropUrl}`);
    }
  }
  console.log(`\nTotal: ${hasCovers} with covers, ${missing} missing.`);
}
audit();
