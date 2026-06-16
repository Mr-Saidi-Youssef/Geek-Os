const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function search() {
  console.log('Searching all accessible objects in Notion...');
  try {
    const res = await notion.search({
      filter: {
        property: 'object',
        value: 'database'
      }
    });
    console.log('\nAccessible Databases:');
    res.results.forEach(db => {
      console.log(`- [${db.id}] Title: ${db.title[0]?.plain_text || 'Untitled'}`);
    });

    const pages = await notion.search({
      filter: {
        property: 'object',
        value: 'page'
      },
      page_size: 20
    });
    console.log('\nRecent Accessible Pages:');
    pages.results.forEach(page => {
      // Find title property
      const titlePropName = Object.keys(page.properties).find(k => page.properties[k].type === 'title');
      const titleText = page.properties[titlePropName]?.title[0]?.plain_text || 'Untitled';
      console.log(`- [${page.id}] Title: ${titleText}`);
    });

  } catch (error) {
    console.error('Error during search:', error.message);
  }
}

search();
