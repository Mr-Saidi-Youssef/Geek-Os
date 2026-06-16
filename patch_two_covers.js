const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = '371d0aaf19d081c59b14fbc0c52b0040';
const notion = new Client({ auth: NOTION_TOKEN });

async function patchMissingCovers() {
  const response = await notion.databases.query({ database_id: DATABASE_ID });
  
  const covers = {
    'Sin City, Vol. 1: The Hard Goodbye': 'https://covers.openlibrary.org/b/id/10650049-L.jpg',
    'Hellboy, Vol. 1: Seed of Destruction': 'https://covers.openlibrary.org/b/id/6327883-L.jpg'
  };

  for (const page of response.results) {
    const title = page.properties.Title?.title?.map(t => t.plain_text).join('') || 'Untitled';
    if (covers[title]) {
      const url = covers[title];
      console.log(`Patching cover for "${title}" with url: ${url}`);
      await notion.pages.update({
        page_id: page.id,
        cover: {
          type: 'external',
          external: { url }
        },
        properties: {
          'Cover Image': {
            files: [{
              name: 'Cover',
              type: 'external',
              external: { url }
            }]
          }
        }
      });
      console.log(`✅ Success for "${title}"`);
    }
  }
}

patchMissingCovers();
