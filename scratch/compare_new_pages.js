const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

async function compare(type, actualId, expectedId) {
  console.log(`\n======================================================`);
  console.log(`VERIFYING ${type.toUpperCase()}`);
  console.log(`Actual:   https://notion.so/${actualId.replace(/-/g, '')}`);
  console.log(`Expected: https://notion.so/${expectedId.replace(/-/g, '')}`);
  console.log(`======================================================`);

  try {
    const actPage = await notion.pages.retrieve({ page_id: actualId });
    const expPage = await notion.pages.retrieve({ page_id: expectedId });

    console.log('\n--- PROPERTIES ---');
    const targetProps = {
      anime: ['Title', 'MAL Score', 'MAL URL', 'Total Episodes', 'Genres', 'Cover Image', 'My Rating'],
      manga: ['Title', 'Authors', 'MAL Score', 'MAL URL', 'MAL ID', 'PublishingStatus', 'My rating'],
      book: ['Title', 'Total Pages ', 'Type', 'My rating'],
      game: ['Title', 'Developer', 'Publisher', 'Metacritic', 'Platform', 'My rating']
    }[type];

    for (const key of targetProps) {
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
    actBlocks.results.slice(0, 25).forEach((b, i) => {
      let t = b[b.type]?.rich_text?.map(x => x.plain_text).join('') || '';
      console.log(`  [${i}] ${b.type} (has_children=${b.has_children}): "${t.substring(0, 50)}"`);
    });

    console.log(`Expected blocks (${expBlocks.results.length}):`);
    expBlocks.results.slice(0, 25).forEach((b, i) => {
      let t = b[b.type]?.rich_text?.map(x => x.plain_text).join('') || '';
      console.log(`  [${i}] ${b.type} (has_children=${b.has_children}): "${t.substring(0, 50)}"`);
    });

  } catch (err) {
    console.error('Comparison error:', err.message);
  }
}

async function run() {
  await compare('anime', '374d0aaf-19d0-816a-b95f-f9ddadee409e', '36dd0aaf-19d0-8111-873e-eadc67b91b57');
  await compare('manga', '374d0aaf-19d0-8195-9d4a-ff4548eac1b8', '370d0aaf-19d0-8187-ae92-e40b5507488d');
  await compare('book', '374d0aaf-19d0-811c-aa3f-db56a5fc28f3', '367d0aaf-19d0-81b0-a17f-f50689675151');
  await compare('game', '374d0aaf-19d0-81f3-94a0-ea247ea6bd72', '36fd0aaf-19d0-8147-82b0-dd54a68ff63f');
}

run();
