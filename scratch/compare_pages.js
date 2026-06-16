const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function compare(type, actualId, expectedId) {
  console.log(`\n======================================================`);
  console.log(`COMPARING ${type.toUpperCase()}`);
  console.log(`Actual:   ${actualId}`);
  console.log(`Expected: ${expectedId}`);
  console.log(`======================================================`);

  try {
    const actPage = await notion.pages.retrieve({ page_id: actualId });
    const expPage = await notion.pages.retrieve({ page_id: expectedId });

    console.log('\n--- PROPERTIES ---');
    const allPropKeys = new Set([...Object.keys(actPage.properties), ...Object.keys(expPage.properties)]);
    for (const key of allPropKeys) {
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

      console.log(`Property "${key}":`);
      console.log(`  Actual:   ${getValString(actVal)}`);
      console.log(`  Expected: ${getValString(expVal)}`);
    }

    console.log('\n--- BLOCKS STRUCTURE ---');
    const actBlocks = await notion.blocks.children.list({ block_id: actualId });
    const expBlocks = await notion.blocks.children.list({ block_id: expectedId });

    console.log(`Actual blocks (${actBlocks.results.length}):`);
    actBlocks.results.slice(0, 15).forEach((b, i) => {
      let t = b[b.type]?.rich_text?.map(x => x.plain_text).join('') || '';
      console.log(`  [${i}] ${b.type} (has_children=${b.has_children}): "${t.substring(0, 50)}"`);
    });

    console.log(`Expected blocks (${expBlocks.results.length}):`);
    expBlocks.results.slice(0, 15).forEach((b, i) => {
      let t = b[b.type]?.rich_text?.map(x => x.plain_text).join('') || '';
      console.log(`  [${i}] ${b.type} (has_children=${b.has_children}): "${t.substring(0, 50)}"`);
    });

  } catch (err) {
    console.error('Comparison error:', err.message);
  }
}

async function run() {
  await compare('anime', '374d0aaf-19d0-8124-909c-efdfa2eb037d', '36dd0aaf-19d0-8111-873e-eadc67b91b57');
  await compare('manga', '374d0aaf-19d0-819a-819b-ffa1890b1d07', '370d0aaf-19d0-8187-ae92-e40b5507488d');
  await compare('book', '374d0aaf-19d0-81bd-a65c-d471e8ddfcea', '367d0aaf-19d0-81b0-a17f-f50689675151');
  await compare('game', '374d0aaf-19d0-81cba396-c5ccc479d4be', '36fd0aaf-19d0-8147-82b0-dd54a68ff63f');
}

run();
