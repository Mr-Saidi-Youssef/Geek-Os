const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function search() {
  console.log('Searching for the TV template or Breaking Bad in your Notion workspace...');
  try {
    const response = await notion.search({
      query: 'Series',
      filter: { property: 'object', value: 'page' }
    });
    console.log(`Found ${response.results.length} pages matching "Series":`);
    for (const page of response.results) {
      const title = page.properties?.Title?.title?.map(t => t.plain_text).join('') || 
                    page.properties?.Name?.title?.map(t => t.plain_text).join('') || 
                    'Untitled';
      console.log(`- Title: "${title}" | ID: ${page.id} | Parent:`, page.parent);
    }

    const responseTemplate = await notion.search({
      query: 'TV',
      filter: { property: 'object', value: 'page' }
    });
    console.log(`\nFound ${responseTemplate.results.length} pages matching "TV":`);
    for (const page of responseTemplate.results) {
      const title = page.properties?.Title?.title?.map(t => t.plain_text).join('') || 
                    page.properties?.Name?.title?.map(t => t.plain_text).join('') || 
                    'Untitled';
      console.log(`- Title: "${title}" | ID: ${page.id} | Parent:`, page.parent);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

search();
