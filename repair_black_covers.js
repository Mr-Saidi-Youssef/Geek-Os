/**
 * Notion Black Cover Repair Engine (Movies, TV Series, & Games)
 * Sweeps Movie, Series, and Games databases to find and repair:
 * 1. Black Covers: IMDb/Amazon CDN links ending in "@.jpg" which are hotlink-protected by Amazon 
 *    when proxied by Notion (returning 403 inside Notion, rendering as black cards). 
 *    These are repaired by replacing the suffix with a safe high-res CDN version: "@._V1_FMjpg_UY750_.jpg".
 * 2. Dead Links (404s): Outdated or broken poster URLs (enabled via --check-404).
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Config
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const MOVIE_DB_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';
const TV_DB_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';
const GAMES_DB_ID = process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf19d0815bb5d3d51ed587a7d1';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not configured in .env\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dryRun = process.argv.includes('--dry-run');
const check404 = process.argv.includes('--check-404');

// Decodes all HTML entities robustly
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#([0-9]+);/gi, (match, numStr) => {
      const num = parseInt(numStr, 10);
      return String.fromCharCode(num);
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, hexStr) => {
      const num = parseInt(hexStr, 16);
      return String.fromCharCode(num);
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Cleans search queries for maximum matching accuracy
function cleanSearchTitle(title) {
  return title
    .replace(/^British\s+/i, '')
    .replace(/^American\s+/i, '')
    .replace(/\(UK\)$/i, '')
    .replace(/\(US\)$/i, '')
    .trim();
}

// Fetches poster cover from OMDb API keylessly
async function getOmdbCover(title, isMovie = true) {
  const typeParam = isMovie ? 'movie' : 'series';
  const queryAttempts = [
    title,
    title.replace(/^(The)\s+/i, '').trim(),
    cleanSearchTitle(title),
    title.split(':')[0].trim(),
    title.split('/')[0].trim()
  ];
  
  const uniqueQueries = [...new Set(queryAttempts.map(q => q.trim()).filter(Boolean))];
  
  for (const q of uniqueQueries) {
    try {
      const url = `http://www.omdbapi.com/?t=${encodeURIComponent(q)}&type=${typeParam}&apikey=thewdb`;
      const res = await axios.get(url, { timeout: 4000 });
      if (res.data && res.data.Poster && res.data.Poster.startsWith('http') && !res.data.Poster.includes('N/A')) {
        // Return with safe resizing suffix to avoid hotlinking block
        return res.data.Poster.replace(/@\._V1_.*\.jpg$/, '@._V1_FMjpg_UY750_.jpg').replace(/@\.jpg$/, '@._V1_FMjpg_UY750_.jpg');
      }
    } catch (err) {
      // Ignore and try next
    }
  }
  return '';
}

// Fetches poster cover from TVMaze search keylessly
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
    
    // Try singlesearch first
    try {
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(q)}`;
      const response = await axios.get(url, { timeout: 4000 });
      if (response.data) {
        const largeCover = response.data.image ? (response.data.image.original || response.data.image.medium) : '';
        if (largeCover) return largeCover;
      }
    } catch (err) {
      // Continue
    }

    // Try list search fallback
    try {
      const fallbackUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
      const resFallback = await axios.get(fallbackUrl, { timeout: 4000 });
      if (resFallback.data && resFallback.data.length > 0) {
        const matchingShow = resFallback.data.find(d => d.show && d.show.image);
        if (matchingShow) {
          const largeCover = matchingShow.show.image.original || matchingShow.show.image.medium || '';
          if (largeCover) return largeCover;
        }
      }
    } catch (e) {
      // Continue
    }
  }
  return '';
}

// Wikipedia HTML infobox cover extraction & upscaling
async function resolveWikipediaCoverHTML(title, type = 'movie') {
  try {
    let typeLabel = 'film';
    if (type === 'series') typeLabel = 'television series';
    else if (type === 'game') typeLabel = 'video game';

    const cleanTitle = title.replace(/\([^)]+\)/g, '').trim();
    const searchUrl = `https://en.wikipedia.org/w/api.php`;
    
    const searchRes = await axios.get(searchUrl, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: `${cleanTitle} ${typeLabel}`,
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
        headers: {
          'User-Agent': 'Mozilla/5.0'
        },
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
          return fullResUrl;
        }
      }
    }
  } catch (err) {
    // Fail silently
  }
  return '';
}

// Tests if a URL returns 404
async function isUrl404(url) {
  if (!url || !url.startsWith('http')) return true;
  try {
    await axios.head(url, {
      timeout: 3000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    return false; // URL works
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return true; // 404 dead link
    }
    return false;
  }
}

// Process a single database
async function processDatabase(dbId, dbType = 'movie') {
  const dbNameMap = {
    'movie': 'Movies',
    'series': 'TV Series',
    'game': 'Games'
  };
  const dbName = dbNameMap[dbType];
  console.log(`\n====================================================`);
  console.log(`🛠️  PROCESSING ${dbName.toUpperCase()} DATABASE`);
  console.log(`====================================================`);

  let checkedCount = 0;
  let blackCoversFound = 0;
  let deadLinksFound = 0;
  let updatedCount = 0;

  let hasMore = true;
  let startCursor = undefined;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: dbId,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        checkedCount++;
        let title = '';
        
        // Get Title
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            title = prop.title[0].plain_text;
            break;
          }
        }
        
        if (!title) continue;
        const decodedTitle = decodeHtmlEntities(title);
        
        // Page cover
        const cover = page.cover;
        const coverUrl = cover && cover.external ? cover.external.url : '';
        
        // Files property cover (specifically for Games database column if it exists)
        let propertyCoverUrl = '';
        if (page.properties.Cover && page.properties.Cover.type === 'files' && page.properties.Cover.files.length > 0) {
          const fileObj = page.properties.Cover.files[0];
          propertyCoverUrl = fileObj.external ? fileObj.external.url : (fileObj.file ? fileObj.file.url : '');
        }

        let needsUpdate = false;
        let patchReason = '';
        let targetCoverUrl = coverUrl || propertyCoverUrl;

        if (targetCoverUrl) {
          // 1. Hotlink Blocked Signature Check
          if (targetCoverUrl.includes('m.media-amazon.com/images/') && targetCoverUrl.endsWith('@.jpg')) {
            needsUpdate = true;
            patchReason = 'Black Cover Signature (@.jpg)';
            targetCoverUrl = targetCoverUrl.replace(/@\.jpg$/, '@._V1_FMjpg_UY750_.jpg');
          } 
          
          // 2. Dead Link check (quick HEAD request if enabled via CLI flag)
          if (!needsUpdate && check404) {
            const isDead = await isUrl404(targetCoverUrl);
            if (isDead) {
              needsUpdate = true;
              patchReason = '404 Dead Link';
            }
          }
        }

        if (needsUpdate) {
          if (patchReason === 'Black Cover Signature (@.jpg)') {
            blackCoversFound++;
            console.log(`[Black Cover Detected] "${decodedTitle}"`);
            console.log(`  Current URL: ${coverUrl || propertyCoverUrl}`);
            console.log(`  Safe Target: ${targetCoverUrl}`);

            if (!dryRun) {
              try {
                // Update params
                const updateParams = {
                  cover: {
                    type: 'external',
                    external: { url: targetCoverUrl }
                  }
                };
                
                // If it is games db and has Cover files property, sync it as well
                if (dbType === 'game' && page.properties.Cover) {
                  updateParams.properties = {
                    'Cover': {
                      files: [{ name: 'Cover Image', type: 'external', external: { url: targetCoverUrl } }]
                    }
                  };
                }

                await notion.pages.update({
                  page_id: page.id,
                  ...updateParams
                });
                updatedCount++;
                console.log(`  \x1b[32m✔ Successfully patched to safe high-res suffix.\x1b[0m`);
              } catch (err) {
                console.error(`  \x1b[31m✘ Failed to patch Notion cover: ${err.message}\x1b[0m`);
              }
              await sleep(350); // rate limiting safety delay
            } else {
              console.log(`  \x1b[33m[Dry Run] Would patch to safe high-res suffix.\x1b[0m`);
            }
          } else if (patchReason === '404 Dead Link') {
            deadLinksFound++;
            console.log(`[Dead Cover Detected] "${decodedTitle}"`);
            console.log(`  Broken URL: ${coverUrl || propertyCoverUrl}`);

            if (!dryRun) {
              console.log(`  Searching replacement cover...`);
              let resolvedCover = '';

              // Try sources
              if (dbType === 'movie') {
                resolvedCover = await getOmdbCover(decodedTitle, true);
                if (!resolvedCover) resolvedCover = await getTvMazeCover(decodedTitle);
              } else if (dbType === 'series') {
                resolvedCover = await getTvMazeCover(decodedTitle);
                if (!resolvedCover) resolvedCover = await getOmdbCover(decodedTitle, false);
              } else if (dbType === 'game') {
                // For games, search Wikipedia video games
                resolvedCover = await resolveWikipediaCoverHTML(decodedTitle, 'game');
              }

              if (!resolvedCover && dbType !== 'game') {
                resolvedCover = await resolveWikipediaCoverHTML(decodedTitle, dbType);
              }

              if (resolvedCover) {
                try {
                  const updateParams = {
                    cover: {
                      type: 'external',
                      external: { url: resolvedCover }
                    }
                  };

                  if (dbType === 'game' && page.properties.Cover) {
                    updateParams.properties = {
                      'Cover': {
                        files: [{ name: 'Cover Image', type: 'external', external: { url: resolvedCover } }]
                      }
                    };
                  }

                  await notion.pages.update({
                    page_id: page.id,
                    ...updateParams
                  });
                  updatedCount++;
                  console.log(`  \x1b[32m✔ Resolved new cover: ${resolvedCover}\x1b[0m`);
                } catch (err) {
                  console.error(`  \x1b[31m✘ Failed to update Notion: ${err.message}\x1b[0m`);
                }
              } else {
                console.log(`  \x1b[31m⚠️  Failed to resolve any replacement cover.\x1b[0m`);
              }
              await sleep(350);
            } else {
              console.log(`  \x1b[33m[Dry Run] Would search and resolve replacement cover.\x1b[0m`);
            }
          }
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`\n🎉 Scan finished for ${dbName}!`);
    console.log(`🟢 Total pages scanned: ${checkedCount}`);
    console.log(`🔴 Black covers found: ${blackCoversFound}`);
    console.log(`🔴 404 dead links found: ${deadLinksFound}`);
    console.log(`🟢 Total covers updated: ${updatedCount}`);

  } catch (err) {
    console.error(`Critical error scanning database ${dbName}: ${err.message}`);
  }
}

async function run() {
  console.log('====================================================');
  console.log(`🚀 MASTER BLACK COVERS REPAIR SWEEP ${dryRun ? '(DRY RUN)' : '(LIVE)'}`);
  console.log(`   Statically scanning for blocked raw IMDb "@.jpg" covers.`);
  if (check404) {
    console.log(`   ⚠️ Deep check enabled: checking for dead 404 covers using live HEAD requests.`);
  } else {
    console.log(`   💡 Static sweep mode: lightning-fast scan without slow Axios HEAD queries.`);
  }
  console.log('====================================================');

  await processDatabase(MOVIE_DB_ID, 'movie');
  await processDatabase(TV_DB_ID, 'series');
  await processDatabase(GAMES_DB_ID, 'game');

  console.log('\n====================================================');
  console.log('🎉 ALL REPAIRS SWEEPS COMPLETE!');
  console.log('====================================================\n');
}

run();
