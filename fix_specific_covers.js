const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '371d0aaf19d081c59b14fbc0c52b0040';
const notion = new Client({ auth: NOTION_TOKEN });

async function fixSpecificCovers() {
  const response = await notion.databases.query({ database_id: DATABASE_ID });
  
  for (const page of response.results) {
    const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || '';
    
    let coverUrl = null;
    if (title.includes('Sin City')) {
      coverUrl = 'https://covers.openlibrary.org/b/id/10650049-L.jpg';
    } else if (title.includes('Hellboy')) {
      coverUrl = 'https://covers.openlibrary.org/b/id/6327883-L.jpg';
    }
    
    if (coverUrl) {
      console.log(`Updating cover for "${title}" to: ${coverUrl}`);
      await notion.pages.update({
        page_id: page.id,
        cover: {
          type: 'external',
          external: { url: coverUrl }
        },
        properties: {
          'Cover Image': {
            files: [{
              name: 'Cover',
              type: 'external',
              external: { url: coverUrl }
            }]
          }
        }
      });
      console.log(`✅ Cover updated successfully.`);
    }
  }
}

fixSpecificCovers();
