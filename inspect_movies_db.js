const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MOVIE_DB_ID = '7ab340245e7e4b22a3685608e103c0aa';
const notion = new Client({ auth: NOTION_TOKEN });

async function inspectMovies() {
  console.log(`Inspecting Movie Library Database: ${MOVIE_DB_ID}...`);
  try {
    const db = await notion.databases.retrieve({ database_id: MOVIE_DB_ID });
    console.log(`Title: "${db.title?.[0]?.plain_text || 'Untitled'}"`);
    console.log('\n--- Properties ---');
    for (const [name, prop] of Object.entries(db.properties)) {
      console.log(`- "${name}" (${prop.type})`);
      if (prop.type === 'select' || prop.type === 'multi_select') {
        const options = prop[prop.type].options.map(o => `${o.name} (${o.color})`);
        console.log(`  Options: ${options.slice(0, 10).join(', ')}${options.length > 10 ? '...' : ''}`);
      }
    }

    console.log('\n--- Searching for template-like pages in the database ---');
    const queryRes = await notion.databases.query({
      database_id: MOVIE_DB_ID,
      page_size: 10
    });
    console.log(`Recent pages in database (${queryRes.results.length} found):`);
    for (const page of queryRes.results) {
      const title = page.properties?.Title?.title?.map(t => t.plain_text).join('') ||
                    page.properties?.Name?.title?.map(t => t.plain_text).join('') || '(Untitled)';
      console.log(`- Page: "${title}" | ID: ${page.id} | Created: ${page.created_time}`);
    }

  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectMovies();
