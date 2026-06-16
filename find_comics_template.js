const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

async function findComicsTemplate() {
  console.log('Searching for "New Comics" or "Comics" template inside Notion...');
  const response = await notion.search({
    query: 'New Comics',
    filter: { value: 'page', property: 'object' }
  });
  
  console.log(`Found ${response.results.length} pages matching "New Comics":`);
  for (const page of response.results) {
    const title = page.properties?.Title?.title?.map(t => t.plain_text).join('') ||
                  page.properties?.Name?.title?.map(t => t.plain_text).join('') || 
                  page.properties?.['Title']?.title?.map(t => t.plain_text).join('') || '(Untitled)';
    console.log(`- Page: "${title}" | ID: ${page.id}`);
  }

  // Also query the Comics database to see if we can find the template inside it or via relations
  const DATABASE_ID = '371d0aaf19d081c59b14fbc0c52b0040';
  try {
    const dbResponse = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: 'Title',
        title: {
          contains: 'Comics'
        }
      }
    });
    console.log(`\nFiltered database query for "Comics" in Title:`);
    for (const page of dbResponse.results) {
      const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
      console.log(`- Page in DB: "${title}" | ID: ${page.id}`);
    }
  } catch (err) {
    console.log('Error querying database:', err.message);
  }
}

findComicsTemplate();
