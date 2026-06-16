const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function searchTemplates() {
  console.log('Searching workspace for "New Movie" or "Movie" templates...');
  try {
    const res = await notion.search({
      query: 'New Movie',
      filter: { value: 'page', property: 'object' }
    });
    
    console.log(`Found ${res.results.length} pages matching "New Movie":`);
    for (const page of res.results) {
      const title = page.properties?.Title?.title?.[0]?.plain_text ||
                    page.properties?.Name?.title?.[0]?.plain_text ||
                    page.properties?.['Title']?.title?.[0]?.plain_text || '(Untitled)';
      console.log(`- Page: "${title}" | ID: ${page.id}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

searchTemplates();
