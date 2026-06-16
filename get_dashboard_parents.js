const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const databases = {
  Movies: '7ab340245e7e4b22a3685608e103c0aa',
  Series: '36dd0aaf19d08123893fcbaf9bff624a',
  Anime: '36dd0aaf19d0800792e7dca0434c570c',
  Manga: '370d0aaf19d08121a36ff3dfcc914532',
  Comics: '371d0aaf19d081c59b14fbc0c52b0040',
  Games: '36fd0aaf19d0815bb5d3d51ed587a7d1',
  Books: '8b2780bfd84442d8bcd95223152c0ece'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry(fn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if ((err.status === 429 || err.code === 'rate_limited') && attempt < 4) {
        const delay = (attempt + 1) * 3000;
        console.log(`\nRate limited. Waiting ${delay}ms before retry...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

async function getParentPageId(currentParent) {
  let parent = currentParent;
  while (true) {
    if (parent.type === 'page_id') {
      return parent.page_id;
    } else if (parent.type === 'block_id') {
      await sleep(400); // Throttling
      const block = await withRetry(() => notion.blocks.retrieve({ block_id: parent.block_id }));
      parent = block.parent;
    } else if (parent.type === 'workspace') {
      return null;
    } else {
      return null;
    }
  }
}

async function getParents() {
  console.log('Resolving grandparent page IDs recursively (with throttling and retries)...\n');
  for (const [name, dbId] of Object.entries(databases)) {
    try {
      const db = await withRetry(() => notion.databases.retrieve({ database_id: dbId }));
      const parentPageId = await getParentPageId(db.parent);
      console.log(`- Database: "${name}" (${dbId})`);
      if (parentPageId) {
        const parentPage = await withRetry(() => notion.pages.retrieve({ page_id: parentPageId }));
        const title = parentPage.properties?.title?.title?.[0]?.plain_text ||
                      parentPage.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
        console.log(`  Parent Page Title: "${title}" | ID: ${parentPageId} | URL: ${parentPage.url}`);
      } else {
        console.log(`  Could not resolve a parent page ID.`);
      }
    } catch (err) {
      console.error(`  Error resolving for "${name}":`, err.message);
    }
    console.log();
  }
}

getParents();
