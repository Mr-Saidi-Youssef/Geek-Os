const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function run() {
  try {
    const res = await notion.blocks.children.list({ block_id: '370d0aaf19d08033b99bf17d506373fd' });
    console.log(`Template game page has ${res.results.length} blocks:`);
    for (let i = 0; i < res.results.length; i++) {
      const b = res.results[i];
      let t = b[b.type]?.rich_text?.map(x => x.plain_text).join('') || '';
      console.log(`[${i}] ${b.type}: "${t}"`);
    }
  } catch (err) {
    console.error(err.message);
  }
}

run();
