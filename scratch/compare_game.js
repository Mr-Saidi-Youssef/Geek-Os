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

    console.log('\n--- PROPERTIES ---');
    for (const key of Object.keys(expPage.properties)) {
      const actVal = actPage.properties[key];
      const expVal = expPage.properties[key];
      
      const getValString = (v) => {
        if (!v) return 'MISSING';
        if (v.type === 'title') return `[title] "${v.title.map(x => x.plain_text).join('')}"`;
        if (v.type === 'rich_text') return `[rich_text] "${v.rich_text.map(x => x.plain_text).join('')}"`;
        if (v.type === 'number') return `[number] ${v.number}`;
        if (v.type === 'select') return `[select] "${v.select?.name}"`;
        if (v.type === 'multi_select') return `[multi_select] [${v.multi_select.map(x => x.name).join(', ')}]`;
        if (v.type === 'url') return `[url] ${v.url}`;
        if (v.type === 'relation') return `[relation] count=${v.relation.length}`;
        if (v.type === 'status') return `[status] "${v.status?.name}"`;
        if (v.type === 'files') return `[files] count=${v.files.length} (${v.files.map(x => x.name || x.external?.url || x.file?.url).join(', ')})`;
        return `[${v.type}]`;
      };

      if (JSON.stringify(actVal) !== JSON.stringify(expVal)) {
        console.log(`Property "${key}":`);
        console.log(`  Actual:   ${getValString(actVal)}`);
        console.log(`  Expected: ${getValString(expVal)}`);
      }
    }

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

compare('game', '374d0aaf-19d0-81cb-a396-c5ccc479d4be', '36fd0aaf-19d0-8147-82b0-dd54a68ff63f');
