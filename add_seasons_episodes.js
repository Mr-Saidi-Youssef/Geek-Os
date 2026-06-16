const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error('Error: NOTION_TOKEN or NOTION_TV_DATABASE_ID is not configured.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function cleanSearchTitle(title) {
  return title
    .replace(/^British\s+/i, '')
    .replace(/^American\s+/i, '')
    .replace(/^Stephen King's\s+/i, '')
    .replace(/\(UK\)$/i, '')
    .replace(/\(US\)$/i, '')
    .trim();
}

async function getTvMazeDetails(title) {
  const queryAttempts = [
    title,
    title.replace(/^(The)\s+/i, '').trim(),
    cleanSearchTitle(title),
    title.split(':')[0].trim(),
    title.split('/')[0].trim()
  ];
  
  const uniqueQueries = [...new Set(queryAttempts.map(q => q.trim()).filter(Boolean))];
  
  for (const q of uniqueQueries) {
    if (!q) continue;
    try {
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(q)}&embed[]=seasons&embed[]=episodes`;
      const response = await axios.get(url);
      if (response.data && response.data._embedded) {
        const seasons = response.data._embedded.seasons.length;
        const episodes = response.data._embedded.episodes.length;
        if (seasons || episodes) {
          return { seasons, episodes };
        }
      }
    } catch (err) {
      // Fail silently, try next query variation
    }

    try {
      const fallbackUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
      const resFallback = await axios.get(fallbackUrl);
      if (resFallback.data && resFallback.data.length > 0) {
        const matchingShow = resFallback.data.find(d => d.show);
        if (matchingShow && matchingShow.show.id) {
          const showId = matchingShow.show.id;
          const detailsUrl = `https://api.tvmaze.com/shows/${showId}?embed[]=seasons&embed[]=episodes`;
          const resDetails = await axios.get(detailsUrl);
          if (resDetails.data && resDetails.data._embedded) {
            const seasons = resDetails.data._embedded.seasons.length;
            const episodes = resDetails.data._embedded.episodes.length;
            if (seasons || episodes) {
              return { seasons, episodes };
            }
          }
        }
      }
    } catch (e) {
      // Ignore fallback failures
    }
  }
  return { seasons: null, episodes: null };
}

async function run() {
  console.log('====================================================');
  console.log('🚀 Starting Seasons & Episodes Database Update...');
  console.log('====================================================');

  try {
    // 1. Update schema to add properties if missing
    console.log('Updating Notion database schema (adding Seasons and Episodes properties if they do not exist)...');
    await notion.databases.update({
      database_id: DATABASE_ID,
      properties: {
        'Seasons': { number: { format: 'number' } },
        'Total Episodes': { number: { format: 'number' } }
      }
    });
    console.log('Schema updated successfully.\n');

    let hasMore = true;
    let cursor = undefined;
    let checked = 0;
    let updated = 0;
    let skipped = 0;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        checked++;
        let title = '';
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            title = prop.title[0].plain_text.trim();
            break;
          }
        }

        if (!title) continue;

        // Check if Seasons and Episodes already exist
        const seasonsProp = page.properties.Seasons;
        const episodesProp = page.properties['Total Episodes'];
        const hasSeasons = seasonsProp && seasonsProp.type === 'number' && seasonsProp.number !== null;
        const hasEpisodes = episodesProp && episodesProp.type === 'number' && episodesProp.number !== null;

        if (hasSeasons && hasEpisodes) {
          console.log(`[Skipping] "${title}" already has Seasons and Episodes configured.`);
          skipped++;
          continue;
        }

        console.log(`Processing: "${title}"`);
        console.log('  Resolving Seasons & Episodes from TVMaze...');
        const { seasons, episodes } = await getTvMazeDetails(title);

        if (seasons !== null || episodes !== null) {
          console.log(`  Found details: Seasons: ${seasons} | Episodes: ${episodes}`);
          
          const updateProps = {};
          if (seasons !== null) updateProps['Seasons'] = { number: seasons };
          if (episodes !== null) updateProps['Total Episodes'] = { number: episodes };

          let updateSuccess = false;
          for (let attempt = 1; attempt <= 5; attempt++) {
            try {
              await notion.pages.update({
                page_id: page.id,
                properties: updateProps
              });
              updateSuccess = true;
              break;
            } catch (notionErr) {
              if (notionErr.code === 'rate_limited') {
                console.log(`  ⏳ Rate limited — waiting 60s before retry (attempt ${attempt}/5)...`);
                await sleep(60000);
              } else {
                throw notionErr;
              }
            }
          }

          if (updateSuccess) {
            console.log(`  \x1b[32mSuccessfully updated "${title}" in Notion!\x1b[0m`);
            updated++;
          } else {
            console.log(`  \x1b[31m⚠️  Could not update "${title}" after 5 retries.\x1b[0m`);
          }
          await sleep(700); // increased delay to avoid rate limiting
        } else {
          console.log(`  \x1b[31m⚠️  Failed to resolve Seasons or Episodes for "${title}"\x1b[0m`);
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    console.log('\n====================================================');
    console.log('🎉 Seasons & Episodes Seeding Completed!');
    console.log(`🟢 Successfully Seeded: ${updated} series pages.`);
    console.log(`⚪ Skipped (Already configured): ${skipped}`);
    console.log(`⚫ Total Pages Checked: ${checked}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in migration script:', error.message);
  }
}

run();
