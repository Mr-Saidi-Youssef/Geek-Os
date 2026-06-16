const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function compare(type, actualId, expectedId) {
  try {
    const actPage = await notion.pages.retrieve({ page_id: actualId });
    const expPage = await notion.pages.retrieve({ page_id: expectedId });

    console.log('Title Property:');
    console.log('  Actual:  ', JSON.stringify(actPage.properties.Title || actPage.properties.Name));
    console.log('  Expected:', JSON.stringify(expPage.properties.Title || expPage.properties.Name));

    console.log('\n--- BLOCKS STRUCTURE ---');
    const actBlocks = await notion.blocks.children.list({ block_id: actualId });
    const expBlocks = await notion.blocks.children.list({ block_id: expectedId });

    console.log(`Actual blocks (${actBlocks.results.length}):`);
    actBlocks.results.forEach((b, i) => {
      let t = b[b.type]?.rich_text?.map(x => x.plain_text).join('') || '';
      console.log(`  [${i}] ${b.type} (has_children=${b.has_children}): "${t.substring(0, 70)}"`);
    });

    console.log(`Expected blocks (${expBlocks.results.length}):`);
    expBlocks.results.forEach((b, i) => {
      let t = b[b.type]?.rich_text?.map(x => x.plain_text).join('') || '';
      console.log(`  [${i}] ${b.type} (has_children=${b.has_children}): "${t.substring(0, 70)}"`);
    });

  } catch (err) {
    console.error('Comparison error:', err.message);
  }
}

compare('anime', '374d0aaf-19d0-8124-909c-efdfa2eb037d', '36dd0aaf-19d0-8111-873e-eadc67b91b57');
