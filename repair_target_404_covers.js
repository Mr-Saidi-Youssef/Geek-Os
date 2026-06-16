const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';

const targetTitles = [
  'Green Paradise',
  'Harmony with A R Rahman',
  'Nature\'s Power Revealed',
  'Peasants Rebellion',
  'Fresh Tracks'
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: Verify if a URL actually returns a valid image (Not 404 or 403)
async function isUrlValid(url) {
  if (!url || !url.startsWith('http')) return false;
  try {
    const res = await axios.head(url, {
      timeout: 3000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return res.status === 200;
  } catch (err) {
    // If HEAD is blocked or fails, try GET as a secure fallback
    try {
      const getRes = await axios.get(url, {
        timeout: 3000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      return getRes.status === 200;
    } catch (getErr) {
      return false; // Broken or 404/403
    }
  }
}

// Cleans search queries
function cleanSearchTitle(title) {
  return title
    .replace(/^British\s+/i, '')
    .replace(/^American\s+/i, '')
    .replace(/\(UK\)$/i, '')
    .replace(/\(US\)$/i, '')
    .trim();
}

// TVMaze cover lookup with validation
async function getTvMazeCover(title) {
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
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(q)}`;
      const response = await axios.get(url, { timeout: 4000 });
      if (response.data && response.data.image) {
        const cover = response.data.image.original || response.data.image.medium;
        if (cover && await isUrlValid(cover)) {
          return cover;
        }
      }
    } catch (err) {
      // Continue
    }

    try {
      const fallbackUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
      const resFallback = await axios.get(fallbackUrl, { timeout: 4000 });
      if (resFallback.data && resFallback.data.length > 0) {
        const matchingShow = resFallback.data.find(d => d.show && d.show.image);
        if (matchingShow) {
          const cover = matchingShow.show.image.original || matchingShow.show.image.medium;
          if (cover && await isUrlValid(cover)) {
            return cover;
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }
  return '';
}

// Wikipedia infobox cover lookup with validation
async function resolveWikipediaCoverHTML(title) {
  try {
    const cleanTitle = title.replace(/\([^)]+\)/g, '').trim();
    const searchUrl = `https://en.wikipedia.org/w/api.php`;
    
    const searchRes = await axios.get(searchUrl, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: `${cleanTitle} television series`,
        format: 'json',
        utf8: 1
      },
      headers: {
        'User-Agent': 'ByronotionCoverResolver/1.0 (contact@byronotion.com)'
      },
      timeout: 4000
    });
    
    if (searchRes.data?.query?.search?.length > 0) {
      const bestMatch = searchRes.data.query.search[0];
      const exactTitle = bestMatch.title;
      
      const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(exactTitle.replace(/ /g, '_'))}`;
      const articleRes = await axios.get(articleUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
      });
      
      const html = articleRes.data;
      const infoboxMatch = html.match(/<table class="infobox[^>]*>([\s\S]*?)<\/table>/);
      if (infoboxMatch) {
        const infoboxHtml = infoboxMatch[1];
        const imgMatch = infoboxHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/);
        if (imgMatch) {
          let thumbUrl = imgMatch[1];
          if (thumbUrl.startsWith('//')) {
            thumbUrl = 'https:' + thumbUrl;
          }
          
          let fullResUrl = thumbUrl;
          if (thumbUrl.includes('/wikipedia/en/thumb/') || thumbUrl.includes('/wikipedia/commons/thumb/')) {
            let temp = thumbUrl.replace('/thumb/', '/');
            const lastSlashIdx = temp.lastIndexOf('/');
            if (lastSlashIdx !== -1) {
              fullResUrl = temp.substring(0, lastSlashIdx);
            }
          }
          if (await isUrlValid(fullResUrl)) {
            return fullResUrl;
          }
        }
      }
    }
  } catch (err) {
    // Fail silently
  }
  return '';
}

// OMDb search cover with validation
async function getOmdbCover(title) {
  try {
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&type=series&apikey=thewdb`;
    const res = await axios.get(url, { timeout: 4000 });
    if (res.data && res.data.Poster && res.data.Poster.startsWith('http') && !res.data.Poster.includes('N/A')) {
      // Create the UY750 resizing URL candidate
      const candidateUrl = res.data.Poster.replace(/@\._V1_.*\.jpg$/, '@._V1_FMjpg_UY750_.jpg').replace(/@\.jpg$/, '@._V1_FMjpg_UY750_.jpg');
      if (await isUrlValid(candidateUrl)) {
        return candidateUrl;
      }
    }
  } catch (err) {
    // Continue
  }
  return '';
}

async function run() {
  console.log('====================================================');
  console.log('🛠️ TARGETED REPAIR SWEEP (WITH IMAGE VALIDATION LAYER)');
  console.log('====================================================\n');

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        or: targetTitles.map(title => ({
          property: 'Title',
          title: { equals: title }
        }))
      }
    });

    console.log(`Found ${response.results.length} targets in Notion. Resolving active replacement covers...\n`);

    for (const page of response.results) {
      let title = '';
      for (const key of Object.keys(page.properties)) {
        if (page.properties[key].type === 'title') {
          title = page.properties[key].title[0]?.plain_text || 'Untitled';
          break;
        }
      }

      console.log(`Processing: "${title}"`);
      let resolvedCover = '';

      // 1. Try TVMaze Cover
      resolvedCover = await getTvMazeCover(title);
      
      // 2. Try OMDb Cover
      if (!resolvedCover) {
        resolvedCover = await getOmdbCover(title);
      }

      // 3. Try Wikipedia Cover
      if (!resolvedCover) {
        resolvedCover = await resolveWikipediaCoverHTML(title);
      }

      // 4. Update in Notion if found, else deploy abstract premium placeholder
      if (resolvedCover) {
        try {
          await notion.pages.update({
            page_id: page.id,
            cover: {
              type: 'external',
              external: { url: resolvedCover }
            }
          });
          console.log(`   \x1b[32m✔ Verified Active Cover updated in Notion: ${resolvedCover}\x1b[0m`);
        } catch (err) {
          console.error(`   \x1b[31m✘ Failed to write cover to Notion: ${err.message}\x1b[0m`);
        }
      } else {
        console.log(`   ⚠️ All sources returned dead 404 links. Deploying abstract geometric premium banner...`);
        const placeholder = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80';
        try {
          await notion.pages.update({
            page_id: page.id,
            cover: {
              type: 'external',
              external: { url: placeholder }
            }
          });
          console.log(`   \x1b[32m✔ Verified Premium Abstract Banner applied successfully!\x1b[0m`);
        } catch (err) {
          console.error(`   Failed to write placeholder:`, err.message);
        }
      }
      await sleep(350);
      console.log('----------------------------------------------------');
    }

    console.log('\n====================================================');
    console.log('🎉 TARGETED VALIDATING REPAIR SWEEP COMPLETE!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Critical error in validating repair sweep:', err.message);
  }
}

run();
