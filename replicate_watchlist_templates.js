const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const databases = {
  Series: '36dd0aaf19d08123893fcbaf9bff624a',
  Anime: '36dd0aaf19d0800792e7dca0434c570c',
  Manga: '370d0aaf19d08121a36ff3dfcc914532',
  Comics: '371d0aaf19d081c59b14fbc0c52b0040',
  Games: '36fd0aaf19d0815bb5d3d51ed587a7d1',
  Books: '8b2780bfd84442d8bcd95223152c0ece'
};

const templates = {
  Movies: '370d0aaf-19d0-8056-8747-df3959410e3f',
  Series: '370d0aaf-19d0-80da-ae71-d2b907a48250',
  Anime: '370d0aaf-19d0-80a1-bede-df457c930950',
  Manga: '372d0aaf-19d0-809a-b9af-ec501c2f56a7',
  Comics: '372d0aaf-19d0-80b7-a8f5-dc7020ea2f21',
  Games: '370d0aaf-19d0-8033-b99b-f17d506373fd'
};

async function withRetry(fn) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if ((err.status === 429 || err.code === 'rate_limited') && attempt < 7) {
        const delay = (attempt + 1) * 3000 + 2000;
        console.log(`⏳ Rate limited. Waiting ${delay}ms before retrying...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

async function clearBlocks(pageId) {
  console.log(`🧹 Clearing all existing blocks on page: ${pageId}...`);
  try {
    const blocks = [];
    let cursor;
    while (true) {
      const res = await withRetry(() => notion.blocks.children.list({
        block_id: pageId,
        start_cursor: cursor
      }));
      blocks.push(...res.results);
      if (!res.next_cursor) break;
      cursor = res.next_cursor;
      await sleep(350);
    }
    
    console.log(`   Found ${blocks.length} blocks to delete.`);
    for (const b of blocks) {
      await withRetry(() => notion.blocks.delete({ block_id: b.id }));
      await sleep(350);
    }
    console.log(`   ✓ All blocks cleared.`);
  } catch (err) {
    console.error(`   ❌ Failed to clear blocks:`, err.message);
  }
}

async function getOrCreateTemplatePage(dbName, dbId) {
  if (templates[dbName]) {
    return templates[dbName];
  }
  
  console.log(`🔍 Template for "${dbName}" not found in config. Querying/Creating...`);
  try {
    // 1. Search database for page starting with "New"
    const queryRes = await withRetry(() => notion.databases.query({
      database_id: dbId,
      page_size: 20
    }));
    
    for (const p of queryRes.results) {
      const title = p.properties?.Title?.title?.map(x => x.plain_text).join('') ||
                    p.properties?.Name?.title?.map(x => x.plain_text).join('') || '';
      if (title.trim().toLowerCase() === `new ${dbName.toLowerCase()}` || title.trim().toLowerCase() === `new book`) {
        console.log(`   Found existing template page: "${title}" | ID: ${p.id}`);
        return p.id;
      }
    }
    
    // 2. Create if not found
    console.log(`   Creating new template page "New ${dbName}" in database ${dbId}...`);
    const titlePropName = dbName === 'Books' ? 'Title' : 'Title';
    
    const pageParams = {
      parent: { database_id: dbId },
      properties: {
        'Title': {
          title: [{ text: { content: `New ${dbName === 'Books' ? 'Book' : dbName}` } }]
        }
      },
      icon: {
        type: 'icon',
        icon: {
          name: dbName === 'Books' ? 'book' : 'book',
          color: 'gray'
        }
      }
    };
    
    // Default inbox status if it exists
    try {
      const db = await withRetry(() => notion.databases.retrieve({ database_id: dbId }));
      if (db.properties['Status']) {
        const statusProp = db.properties['Status'];
        if (statusProp.type === 'status') {
          const hasInbox = statusProp.status?.options?.some(opt => opt.name === 'Inbox');
          if (hasInbox) {
            pageParams.properties['Status'] = { status: { name: 'Inbox' } };
          } else {
            const hasNotStarted = statusProp.status?.options?.some(opt => opt.name === 'Not started');
            if (hasNotStarted) {
              pageParams.properties['Status'] = { status: { name: 'Not started' } };
            }
          }
        } else if (statusProp.type === 'select') {
          const hasInbox = statusProp.select?.options?.some(opt => opt.name === 'Inbox');
          if (hasInbox) {
            pageParams.properties['Status'] = { select: { name: 'Inbox' } };
          } else {
            const hasNotStarted = statusProp.select?.options?.some(opt => opt.name === 'Not started');
            if (hasNotStarted) {
              pageParams.properties['Status'] = { select: { name: 'Not started' } };
            }
          }
        }
      }
    } catch (_) {}
    
    const newPage = await withRetry(() => notion.pages.create(pageParams));
    console.log(`   ✓ Template page created successfully! ID: ${newPage.id}`);
    return newPage.id;
  } catch (err) {
    console.error(`   ❌ Failed to get/create template page for ${dbName}:`, err.message);
    return null;
  }
}

function getRatingCriteria(dbName) {
  if (dbName === 'Games') {
    return [
      '🎮 Gameplay — /5',
      '🕹️ Mechanics & Controls — /5',
      '🎨 Graphics & Sound — /5',
      '🔁 Replay Value — /5',
      '🧠 One-line verdict: ...'
    ];
  } else if (dbName === 'Comics' || dbName === 'Manga') {
    return [
      '📚 Story / Plot — /5',
      '🎨 Art & Illustration — /5',
      '🎭 Character Development — /5',
      '🔁 Re-readability — /5',
      '🧠 One-line verdict: ...'
    ];
  } else if (dbName === 'Books') {
    return [
      '📖 Writing Style & Prose — /5',
      '📚 Story / Plot — /5',
      '🎭 Character Depth — /5',
      '🔁 Re-readability — /5',
      '🧠 One-line verdict: ...'
    ];
  } else {
    // Movies / Series / Anime
    return [
      '🎬 Story / Plot — /5',
      '🎭 Acting & Cast — /5',
      '🎨 Visuals & Score — /5',
      '🔁 Rewatchability — /5',
      '🧠 One-line verdict: ...'
    ];
  }
}

async function writeTemplateLayout(dbName, pageId) {
  console.log(`✍ Writing beautiful Movies-style layout to "${dbName}" template...`);
  
  // Custom prefix for Review callout Watched/Played/Read
  let verb = 'Watched';
  let device = 'with';
  let iconName = 'movie-camera';
  if (dbName === 'Games') {
    verb = 'Played';
    device = 'on';
    iconName = 'video-game';
  } else if (dbName === 'Books' || dbName === 'Comics' || dbName === 'Manga') {
    verb = 'Read';
    device = 'format';
    iconName = 'book';
  }

  const ratingCriteria = getRatingCriteria(dbName);
  
  // 1. Synopsis Callout Block
  const synopsisCallout = {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [],
      icon: { type: 'icon', icon: { name: 'info-alternate', color: 'gray' } },
      color: 'gray_background'
    }
  };

  try {
    const parentBlockRes = await withRetry(() => notion.blocks.children.append({
      block_id: pageId,
      children: [synopsisCallout]
    }));
    const synopsisCalloutId = parentBlockRes.results[0].id;
    await sleep(350);
    
    // Add Synopsis children inside Callout
    const synopsisChildren = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: 'Synopsis' } }],
          color: 'default'
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [],
          color: 'default'
        }
      }
    ];
    await withRetry(() => notion.blocks.children.append({
      block_id: synopsisCalloutId,
      children: synopsisChildren
    }));
    await sleep(350);
  } catch (err) {
    console.error('   Failed appending Synopsis callout:', err.message);
  }

  // 2. Trailer Block (if applicable)
  const hasTrailer = ['Movies', 'Series', 'Anime', 'Games'].includes(dbName);
  if (hasTrailer) {
    try {
      const trailerBlocks = [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Trailer' } }],
            color: 'default'
          }
        },
        {
          object: 'block',
          type: 'video',
          video: {
            type: 'external',
            external: { url: 'https://www.youtube.com/watch?v=YoHD9XEInc0' }
          }
        }
      ];
      await withRetry(() => notion.blocks.children.append({
        block_id: pageId,
        children: trailerBlocks
      }));
      await sleep(350);
    } catch (err) {
      console.error('   Failed appending Trailer block:', err.message);
    }
  }

  // 3. Information details block
  try {
    const infoBlocks = [];
    if (dbName === 'Series') {
      infoBlocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Cast & Crew' } }],
            color: 'default'
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Director: ' }, annotations: { bold: true } }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Starring: ' }, annotations: { bold: true } }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } }
            ]
          }
        },
        {
          object: 'block',
          type: 'divider',
          divider: {}
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Seasons' } }],
            color: 'default',
            is_toggleable: true
          }
        }
      );
    } else if (dbName === 'Anime') {
      infoBlocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Informations' } }],
            color: 'default'
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: []
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Characters & Voice Actors' } }],
            color: 'default'
          }
        },
        {
          object: 'block',
          type: 'divider',
          divider: {}
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Episodes' } }],
            color: 'default',
            is_toggleable: true
          }
        }
      );
    } else if (dbName === 'Comics' || dbName === 'Manga') {
      infoBlocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Informations' } }],
            color: 'default'
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: []
          }
        },
        {
          object: 'block',
          type: 'divider',
          divider: {}
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Volumes and Story arcs' } }],
            color: 'default',
            is_toggleable: true
          }
        },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Single Issues' } }],
            color: 'default',
            is_toggleable: true
          }
        }
      );
    } else if (dbName === 'Games') {
      infoBlocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Informations' } }],
            color: 'default'
          }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: []
          }
        }
      );
    } else if (dbName === 'Books') {
      infoBlocks.push(
        {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: 'Informations' } }],
            color: 'default'
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Author: ' }, annotations: { bold: true } }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Publisher: ' }, annotations: { bold: true } }
            ]
          }
        },
        {
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [
              { type: 'text', text: { content: 'Pages: ' }, annotations: { bold: true } }
            ]
          }
        }
      );
    }

    infoBlocks.push({
      object: 'block',
      type: 'divider',
      divider: {}
    });

    await withRetry(() => notion.blocks.children.append({
      block_id: pageId,
      children: infoBlocks
    }));
    await sleep(350);
  } catch (err) {
    console.error('   Failed appending info blocks:', err.message);
  }

  // 4. My Review Heading & Callout
  try {
    const reviewHeading = {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: 'My Review' } }],
        color: 'default'
      }
    };
    await withRetry(() => notion.blocks.children.append({
      block_id: pageId,
      children: [reviewHeading]
    }));
    await sleep(350);

    const reviewCallout = {
      object: 'block',
      type: 'callout',
      callout: {
        rich_text: [],
        icon: { type: 'icon', icon: { name: iconName, color: 'gray' } },
        color: 'gray_background'
      }
    };
    const reviewCalloutRes = await withRetry(() => notion.blocks.children.append({
      block_id: pageId,
      children: [reviewCallout]
    }));
    const reviewCalloutId = reviewCalloutRes.results[0].id;
    await sleep(350);

    // Rebuild child review structure inside callout
    const reviewChildren = [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `${verb} on: ` } }
          ]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: `${verb} ${device}: ` } }
          ]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: 'What worked' } }
          ]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: []
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: "What i didn't like" } }
          ]
        }
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: []
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', text: { content: 'Ratings' } }
          ]
        }
      }
    ];

    // Add criteria bullets
    ratingCriteria.forEach(criteria => {
      reviewChildren.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: criteria } }]
        }
      });
    });

    await withRetry(() => notion.blocks.children.append({
      block_id: reviewCalloutId,
      children: reviewChildren
    }));
    await sleep(350);
    console.log(`   ✓ Layout written successfully.`);
  } catch (err) {
    console.error('   Failed appending Review block:', err.message);
  }
}

async function run() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('🚀  STARTING TRACKERS DESIGN ALIGNMENT & TEMPLATE SYNC');
  console.log('══════════════════════════════════════════════════════\n');
  
  for (const [dbName, dbId] of Object.entries(databases)) {
    console.log(`\n--------------------------------------------`);
    console.log(`Tracker: "${dbName}" (${dbId})`);
    console.log(`--------------------------------------------`);
    
    // 1. Get or create the database inside template page
    const pageId = await getOrCreateTemplatePage(dbName, dbId);
    if (!pageId) {
      console.log(`   ⚠️ Skipping sync for ${dbName} (no template resolved).`);
      continue;
    }
    
    // 2. Clear blocks on template
    await clearBlocks(pageId);
    await sleep(500);
    
    // 3. Write elegant Movie-style layout
    await writeTemplateLayout(dbName, pageId);
    await sleep(500);
  }
  
  console.log('\n══════════════════════════════════════════════════════');
  console.log('🎉  ALL Database inside templates successfully synced!');
  console.log('══════════════════════════════════════════════════════\n');
}

run();
