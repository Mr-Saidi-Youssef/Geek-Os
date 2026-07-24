const express = require('express');
const { Client } = require('@notionhq/client');
const axios = require('axios');
const path = require('path');
require('dotenv').config();
const connectionsDb = require('./connections_db');
const { put } = require('@vercel/blob');
const { get: getEdgeConfig } = require('@vercel/edge-config');

const app = express();

// Middleware: Set Edge Cache headers for 24h
function setEdgeCache(req, res, next) {
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
  next();
}

// Middleware: Check Vercel Edge Config feature flags
async function checkFeatureFlag(category, res, next) {
  if (!process.env.EDGE_CONFIG) {
    return next();
  }
  try {
    const flags = await getEdgeConfig('featureFlags');
    if (flags && flags[category] === false) {
      return res.status(403).json({
        error: `The ${category || 'media'} search service is temporarily disabled.`,
        code: 'SERVICE_DISABLED'
      });
    }
  } catch (err) {
    console.warn('⚠️ Edge Config flag check failed:', err.message);
  }
  next();
}

// Helper: Upload cover image to Vercel Blob storage
async function uploadCoverToBlob(coverUrl, title, type) {
  if (!coverUrl || coverUrl === 'N/A') return null;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return coverUrl;
  }
  try {
    console.log(`📸 Uploading cover to Vercel Blob for ${title} (${type})...`);
    const response = await axios.get(coverUrl, { 
      responseType: 'arraybuffer',
      timeout: 6000
    });
    
    const buffer = Buffer.from(response.data, 'binary');
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const ext = contentType.split('/')[1] || 'jpg';
    
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filepath = `covers/${type}/${safeTitle}_${Date.now()}.${ext}`;
    
    const blob = await put(filepath, buffer, {
      access: 'public',
      contentType: contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN
    });
    
    console.log(`✓ Uploaded cover to Vercel Blob: ${blob.url}`);
    return blob.url;
  } catch (err) {
    console.warn(`⚠️ Failed to upload cover to Vercel Blob:`, err.message);
    return coverUrl;
  }
}
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) {
  console.error('❌ Error: NOTION_TOKEN is not configured in .env');
  process.exit(1);
}

const devNotion = new Client({ auth: NOTION_TOKEN });
const notion = devNotion;

// Database Configurations
const DB_IDS = {
  anime: process.env.NOTION_DATABASE_ID || '36dd0aaf19d0800792e7dca0434c570c',
  manga: process.env.NOTION_MANGA_DATABASE_ID || '370d0aaf-19d0-8121-a36f-f3dfcc914532',
  game: process.env.NOTION_GAMES_DATABASE_ID || '36fd0aaf-19d0-815b-b5d3-d51ed587a7d1',
  comic: process.env.NOTION_COMICS_DATABASE_ID || '371d0aaf-19d0-81c5-9b14-fbc0c52b0040',
  movie: process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa',
  tv: process.env.NOTION_TV_DATABASE_ID || '36dd0aaf-19d0-8123-893f-cbaf9bff624a',
  book: '8b2780bfd84442d8bcd95223152c0ece'
};

const AUTHORS_DB_ID = '367d0aaf-19d0-803e-ac0a-d33d3c82c581';
const GENRES_DB_ID = '37d28afc-7789-44af-8035-2bb161318e31';

// Template Configurations
const TEMPLATE_IDS = {
  anime: '370d0aaf-19d0-80a1-bede-df457c930950',
  manga: '372d0aaf-19d0-8188-b3bb-efd5ddd80947',
  game: process.env.NOTION_GAMES_TEMPLATE_ID || '370d0aaf19d08033b99bf17d506373fd',
  comic: process.env.NOTION_COMICS_TEMPLATE_ID || '372d0aaf19d080b7a8f5dc7020ea2f21',
  movie: '370d0aaf-19d0-8056-8747-df3959410e3f', // Inception page
  tv: '370d0aaf-19d0-80da-ae71-d2b907a48250',
  book: '372d0aaf-19d0-81e4-9db2-e1837e15461f'
};

// OMDB API Key (Free key from workspace config)
const OMDB_API_KEY = 'thewdb';

// Helper: safe sleep
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Helper: clean media titles
function cleanMediaTitle(title, type) {
  if (!title) return '';
  let clean = title.replace(/^[\p{Emoji}\s]+/u, '').trim();
  if (type === 'tv' || type === 'anime') {
    // Only split by space-surrounded hyphens, NOT colons to preserve official titles like "Frieren: Beyond Journey's End"
    clean = clean.split(/\s+[-–—]\s+/)[0].trim();
    clean = clean.replace(/\s*\(TV\)\s*/i, '').trim();
    clean = clean.replace(/\s*\(TV\s+Series\)\s*/i, '').trim();
    clean = clean.replace(/\s*\(TV\s+Show\)\s*/i, '').trim();
  }
  return clean;
}

// Helper: weserv cover formatter
function formatCoverUrl(url) {
  if (!url || url === 'N/A') return null;
  let cleanUrl = url;
  if (cleanUrl.includes('m.media-amazon.com/images/')) {
    cleanUrl = cleanUrl.replace(/@\._V1_.*\.jpg$/, '@.jpg');
  }
  if (cleanUrl.includes('myanimelist.net')) {
    return cleanUrl;
  }
  return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`;
}

// Helper: YouTube Search Trailer lookup keylessly
async function getYoutubeTrailer(title, year) {
  try {
    const q = encodeURIComponent(`${title} ${year || ''} official trailer`);
    const r = await axios.get(`https://www.youtube.com/results?search_query=${q}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 7000
    });
    const m = r.data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
  } catch (_) {}
  return null;
}

// Helper: clean page blocks for creation
function cleanBlock(block) {
  const clean = {
    object: 'block',
    type: block.type,
    [block.type]: { ...block[block.type] }
  };
  delete clean[block.type].has_children;
  if (clean[block.type].icon === null) delete clean[block.type].icon;
  return clean;
}

// Helper: auto-detect book type based on genre/synopsis keywords
function detectBookType(genres, title, synopsis) {
  const nonFictionKeywords = [
    'self-help', 'business', 'economics', 'finance', 'biography', 'autobiography', 'memoir',
    'history', 'psychology', 'science', 'technology', 'philosophy', 'religion', 'education',
    'health', 'fitness', 'diet', 'cooking', 'travel', 'art', 'design', 'photography', 'crafts',
    'political', 'politics', 'sociology', 'anthropology', 'parenting', 'relationships',
    'personal development', 'productivity', 'reference', 'essay', 'essays', 'true crime',
    'habits', 'mindset', 'guide', 'success', 'growth'
  ];
  
  const allText = [
    ...(genres || []),
    title || '',
    synopsis || ''
  ].join(' ').toLowerCase();

  for (const keyword of nonFictionKeywords) {
    if (allText.includes(keyword)) {
      return 'Non-Fiction';
    }
  }
  return 'Fiction';
}

// Helper: set property safely checking if it exists in database schema
function setSafeProperty(properties, dbSchema, name, value, typeOverride = null) {
  if (value === undefined || value === null || value === '') return;
  const prop = dbSchema.properties[name];
  if (!prop) return; // property doesn't exist in database schema

  const type = typeOverride || prop.type;

  if (type === 'rich_text') {
    properties[name] = { rich_text: [{ text: { content: String(value).substring(0, 2000) } }] };
  } else if (type === 'number') {
    const num = parseFloat(value);
    if (!isNaN(num)) properties[name] = { number: num };
  } else if (type === 'url') {
    properties[name] = { url: value };
  } else if (type === 'select') {
    properties[name] = { select: { name: String(value) } };
  } else if (type === 'multi_select') {
    const arr = Array.isArray(value) ? value : [value];
    properties[name] = { multi_select: arr.map(item => ({ name: String(item) })) };
  } else if (type === 'status') {
    properties[name] = { status: { name: String(value) } };
  } else if (type === 'files') {
    properties[name] = { files: [{ name: 'Cover Image', type: 'external', external: { url: value } }] };
  } else if (type === 'date') {
    properties[name] = { date: { start: value } };
  }
}


// Helper: live copy template blocks to new page
async function copyTemplateBlocks(userNotion, sourcePageId, targetPageId, mediaData) {
  if (!sourcePageId) return;
  const notion = {
    blocks: {
      children: {
        list: (args) => devNotion.blocks.children.list(args),
        append: (args) => userNotion.blocks.children.append(args)
      }
    }
  };
  try {
    console.log(`📋 Loading template blocks from ${sourcePageId}...`);
    const res = await notion.blocks.children.list({ block_id: sourcePageId });
    const topBlocks = res.results;

    const childrenMap = {};
    for (const block of topBlocks) {
      if (block.has_children && block.type !== 'child_database') {
        try {
          const childRes = await notion.blocks.children.list({ block_id: block.id });
          childrenMap[block.id] = childRes.results;
        } catch (_) {}
      }
    }

    console.log(`✍ Appending ${topBlocks.length} blocks to new page ${targetPageId}...`);
    for (const block of topBlocks) {
      if (block.type === 'child_database') continue;

      const newBlock = cleanBlock(block);

      // Callout processing (fixes duplicate synopsis in review block)
      if (block.type === 'callout' && block.has_children) {
        const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
        const isSynopsis = text.toLowerCase().includes('synopsis') || 
          (childrenMap[block.id] && childrenMap[block.id][0]?.type === 'heading_2' && 
           childrenMap[block.id][0]?.heading_2?.rich_text?.[0]?.plain_text === 'Synopsis');
           
        const isReview = text.toLowerCase().includes('watched') || 
          text.toLowerCase().includes('played') || 
          text.toLowerCase().includes('read') || 
          text.toLowerCase().includes('review') ||
          text.toLowerCase().includes('like') ||
          text.toLowerCase().includes('verdict');

        if (isSynopsis) {
          const calloutRes = await notion.blocks.children.append({
            block_id: targetPageId,
            children: [newBlock]
          });
          const newCalloutId = calloutRes.results[0].id;

          const templateChildren = childrenMap[block.id] || [];
          const newChildren = templateChildren.map(child => {
            const c = cleanBlock(child);
            if (child.type === 'paragraph' && mediaData.synopsis) {
              c.paragraph.rich_text = [{ type: 'text', text: { content: mediaData.synopsis.substring(0, 2000) } }];
            }
            return c;
          });

          if (newChildren.length > 0) {
            await notion.blocks.children.append({ block_id: newCalloutId, children: newChildren });
          }
          continue;
        } else if (isReview) {
          const reviewRes = await notion.blocks.children.append({
            block_id: targetPageId,
            children: [newBlock]
          });
          const reviewCalloutId = reviewRes.results[0].id;

          const reviewChildren = (childrenMap[block.id] || []).map(child => cleanBlock(child));
          if (reviewChildren.length > 0) {
            await notion.blocks.children.append({ block_id: reviewCalloutId, children: reviewChildren });
          }
          continue;
        } else {
          // Other callouts (e.g. key facts) copied unmodified
          const calloutRes = await notion.blocks.children.append({
            block_id: targetPageId,
            children: [newBlock]
          });
          const newCalloutId = calloutRes.results[0].id;

          const otherChildren = (childrenMap[block.id] || []).map(child => cleanBlock(child));
          if (otherChildren.length > 0) {
            await notion.blocks.children.append({ block_id: newCalloutId, children: otherChildren });
          }
          continue;
        }
      }

      // Video trailer block
      if (block.type === 'video' && mediaData.trailerUrl) {
        newBlock.video = { external: { url: mediaData.trailerUrl } };
      }

      // Cast & specs bullet list replacements
      if (block.type === 'bulleted_list_item') {
        const text = block.bulleted_list_item.rich_text?.map(t => t.plain_text).join('') || '';
        if (text.startsWith('Director:') && mediaData.director) {
          newBlock.bulleted_list_item.rich_text = [
            { type: 'text', text: { content: 'Director: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: mediaData.director } }
          ];
        } else if (text.startsWith('Starring:') && mediaData.actors) {
          newBlock.bulleted_list_item.rich_text = [
            { type: 'text', text: { content: 'Starring: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: mediaData.actors } }
          ];
        } else if (text.startsWith('Writer:') && mediaData.writer) {
          newBlock.bulleted_list_item.rich_text = [
            { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: mediaData.writer } }
          ];
        } else if (text.startsWith('Author:') && mediaData.author) {
          newBlock.bulleted_list_item.rich_text = [
            { type: 'text', text: { content: 'Author: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: mediaData.author } }
          ];
        } else if (text.startsWith('Developer:') && mediaData.developer) {
          newBlock.bulleted_list_item.rich_text = [
            { type: 'text', text: { content: 'Developer: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: mediaData.developer } }
          ];
        } else if (text.startsWith('Publisher:') && mediaData.publisher) {
          newBlock.bulleted_list_item.rich_text = [
            { type: 'text', text: { content: 'Publisher: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: mediaData.publisher } }
          ];
        } else if (text.startsWith('Pages:') && mediaData.pages) {
          newBlock.bulleted_list_item.rich_text = [
            { type: 'text', text: { content: 'Pages: ' }, annotations: { bold: true } },
            { type: 'text', text: { content: String(mediaData.pages) } }
          ];
        }
      }

      // Informations row replacements (specs paragraphs)
      if (block.type === 'paragraph') {
        const index = topBlocks.indexOf(block);
        if (index > 0 && topBlocks[index - 1].type === 'heading_2') {
          const prevText = topBlocks[index - 1].heading_2.rich_text?.map(t => t.plain_text).join('') || '';
          if (prevText.toLowerCase().includes('information')) {
            if (mediaData.type === 'anime') {
              newBlock.paragraph.rich_text = [
                { type: 'text', text: { content: 'Format: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.animeFormat || 'TV'}  |  ` } },
                { type: 'text', text: { content: 'Studios: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.animeStudio || 'N/A'}  |  ` } },
                { type: 'text', text: { content: 'Aired: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.animeAired || 'N/A'}  |  ` } },
                { type: 'text', text: { content: 'Score: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `⭐ ${mediaData.animeScore || '0'}` } }
              ];
            } else if (mediaData.type === 'manga') {
              newBlock.paragraph.rich_text = [
                { type: 'text', text: { content: 'Author: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.author || 'Unknown'}  |  ` } },
                { type: 'text', text: { content: 'Volumes: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.mangaVolumes || 'N/A'}  |  ` } },
                { type: 'text', text: { content: 'Chapters: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.mangaChapters || 'N/A'}  |  ` } },
                { type: 'text', text: { content: 'Status: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.mangaStatus || 'N/A'}` } }
              ];
            } else if (mediaData.type === 'comic') {
              newBlock.paragraph.rich_text = [
                { type: 'text', text: { content: 'Writer: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.writer || 'Unknown'}  |  ` } },
                { type: 'text', text: { content: 'Artist: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.artist || 'Unknown / Multiple'}  |  ` } },
                { type: 'text', text: { content: 'Publisher: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.publisher || 'Unknown'}  |  ` } },
                { type: 'text', text: { content: 'Release: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.releaseYear || 'N/A'}` } }
              ];
            } else if (mediaData.type === 'game') {
              newBlock.paragraph.rich_text = [
                { type: 'text', text: { content: 'Developer: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.developer || 'N/A'}  |  ` } },
                { type: 'text', text: { content: 'Publisher: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.publisher || 'N/A'}  |  ` } },
                { type: 'text', text: { content: 'Release: ' }, annotations: { bold: true } },
                { type: 'text', text: { content: `${mediaData.releaseYear || 'N/A'}` } }
              ];
            }
          }
        }
      }

      // Dynamic Seasons Toggle list for TV Show
      if (block.type === 'heading_2' && mediaData.type === 'tv') {
        const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (text.toLowerCase().includes('seasons') && mediaData.tvMazeDetails?.seasonsCount > 0) {
          newBlock.heading_2.is_toggleable = true;

          const seasonsHeadingRes = await notion.blocks.children.append({
            block_id: targetPageId,
            children: [newBlock]
          });
          const seasonsHeadingId = seasonsHeadingRes.results[0].id;

          const seasonsMap = {};
          mediaData.tvMazeDetails.episodesList.forEach(ep => {
            if (!seasonsMap[ep.season]) seasonsMap[ep.season] = [];
            seasonsMap[ep.season].push(ep);
          });

          for (let s = 1; s <= mediaData.tvMazeDetails.seasonsCount; s++) {
            const seasonEpisodes = seasonsMap[s] || [];
            if (seasonEpisodes.length === 0) continue;

            const seasonToggleBlock = {
              object: 'block',
              type: 'heading_3',
              heading_3: {
                rich_text: [{ type: 'text', text: { content: `Season ${s}` } }],
                color: 'default',
                is_toggleable: true
              }
            };

            const sToggleRes = await notion.blocks.children.append({
              block_id: seasonsHeadingId,
              children: [seasonToggleBlock]
            });
            const seasonToggleId = sToggleRes.results[0].id;

            const todoBlocks = seasonEpisodes.map(ep => ({
              object: 'block',
              type: 'to_do',
              to_do: {
                rich_text: [{ type: 'text', text: { content: `S${ep.season}E${ep.number}: ${ep.name}` } }],
                checked: false
              }
            }));

            for (let k = 0; k < todoBlocks.length; k += 100) {
              const batch = todoBlocks.slice(k, k + 100);
              await notion.blocks.children.append({ block_id: seasonToggleId, children: batch });
            }
          }
          continue;
        }
      }

      // Dynamic Characters Toggle list for Anime
      if (block.type === 'heading_2' && mediaData.type === 'anime') {
        const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (text.toLowerCase().includes('character') && mediaData.malCharacters?.length > 0) {
          newBlock.heading_2.is_toggleable = true;

          const charHeadingRes = await notion.blocks.children.append({
            block_id: targetPageId,
            children: [newBlock]
          });
          const charHeadingId = charHeadingRes.results[0].id;

          const bulletBlocks = mediaData.malCharacters.map(char => ({
            object: 'block',
            type: 'bulleted_list_item',
            bulleted_list_item: {
              rich_text: [
                { type: 'text', text: { content: `🎭 ${char.name} ` } },
                { type: 'text', text: { content: '— VA: ' }, annotations: { italic: true } },
                { type: 'text', text: { content: `${char.va} (Japanese)` }, annotations: { italic: true } }
              ]
            }
          }));

          if (bulletBlocks.length > 0) {
            await notion.blocks.children.append({ block_id: charHeadingId, children: bulletBlocks });
          }
          continue;
        }
      }

      // Dynamic Episodes Toggle list for Anime
      if (block.type === 'heading_2' && mediaData.type === 'anime') {
        const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (text.toLowerCase().includes('episode') && mediaData.malEpisodes?.length > 0) {
          newBlock.heading_2.is_toggleable = true;

          const epHeadingRes = await notion.blocks.children.append({
            block_id: targetPageId,
            children: [newBlock]
          });
          const epHeadingId = epHeadingRes.results[0].id;

          const todoBlocks = mediaData.malEpisodes.map(ep => ({
            object: 'block',
            type: 'to_do',
            to_do: {
              rich_text: [{ type: 'text', text: { content: `Ep ${ep.number}: ${ep.name}` } }],
              checked: false
            }
          }));

          for (let k = 0; k < todoBlocks.length; k += 100) {
            const batch = todoBlocks.slice(k, k + 100);
            await notion.blocks.children.append({ block_id: epHeadingId, children: batch });
          }
          continue;
        }
      }

      // Dynamic Volumes Toggle list for Manga
      if (block.type === 'heading_2' && mediaData.type === 'manga') {
        const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (text.toLowerCase().includes('volume')) {
          newBlock.heading_2.is_toggleable = true;
          const headingRes = await notion.blocks.children.append({
            block_id: targetPageId,
            children: [newBlock]
          });
          const headingId = headingRes.results[0].id;

          const totalVolumes = parseInt(mediaData.mangaVolumes, 10) || 1;
          const volumeChildren = [];
          for (let v = 1; v <= Math.min(totalVolumes, 100); v++) {
            volumeChildren.push({
              object: 'block',
              type: 'to_do',
              to_do: {
                rich_text: [{ type: 'text', text: { content: `Volume ${v}` } }],
                checked: false
              }
            });
          }

          if (volumeChildren.length > 0) {
            await notion.blocks.children.append({ block_id: headingId, children: volumeChildren });
          }
          continue;
        }
      }

      // Dynamic Chapters Toggle list for Manga
      if (block.type === 'heading_2' && mediaData.type === 'manga') {
        const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (text.toLowerCase().includes('single') || text.toLowerCase().includes('chapter')) {
          newBlock.heading_2.is_toggleable = true;
          const headingRes = await notion.blocks.children.append({
            block_id: targetPageId,
            children: [newBlock]
          });
          const headingId = headingRes.results[0].id;

          const totalChapters = parseInt(mediaData.mangaChapters, 10) || 10;
          const maxChapters = mediaData.mangaVolumes ? Math.min(totalChapters, 60) : 40;
          const chapterChildren = [];
          for (let ch = 1; ch <= maxChapters; ch++) {
            chapterChildren.push({
              object: 'block',
              type: 'to_do',
              to_do: {
                rich_text: [{ type: 'text', text: { content: `Chapter ${ch}` } }],
                checked: false
              }
            });
          }

          for (let offset = 0; offset < chapterChildren.length; offset += 50) {
            const chunk = chapterChildren.slice(offset, offset + 50);
            await notion.blocks.children.append({ block_id: headingId, children: chunk });
          }
          continue;
        }
      }

      // Dynamic Volumes Toggle list for Comics
      if (block.type === 'heading_2' && mediaData.type === 'comic') {
        const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (text.toLowerCase().includes('volume')) {
          newBlock.heading_2.is_toggleable = true;
          const headingRes = await notion.blocks.children.append({
            block_id: targetPageId,
            children: [newBlock]
          });
          const headingId = headingRes.results[0].id;

          const totalVolumes = parseInt(mediaData.comicVolumes, 10) || 1;
          const volumeChildren = [];
          const titleContent = mediaData.title || '';
          for (let v = 1; v <= Math.min(totalVolumes, 100); v++) {
            let suffix = `Vol. ${v}`;
            if (totalVolumes === 1) suffix = 'Collected Deluxe Edition';
            else if (v === 1 && totalVolumes === 2) suffix = 'Book One';
            else if (v === 2 && totalVolumes === 2) suffix = 'Book Two';

            volumeChildren.push({
              object: 'block',
              type: 'to_do',
              to_do: {
                rich_text: [{ type: 'text', text: { content: `Volume ${v}: ${titleContent} (${suffix})` } }],
                checked: false
              }
            });
          }

          if (volumeChildren.length > 0) {
            await notion.blocks.children.append({ block_id: headingId, children: volumeChildren });
          }
          continue;
        }
      }

      // Dynamic Issues Toggle list for Comics
      if (block.type === 'heading_2' && mediaData.type === 'comic') {
        const text = block.heading_2.rich_text?.map(t => t.plain_text).join('') || '';
        if (text.toLowerCase().includes('issue') || text.toLowerCase().includes('single')) {
          newBlock.heading_2.is_toggleable = true;
          const headingRes = await notion.blocks.children.append({
            block_id: targetPageId,
            children: [newBlock]
          });
          const headingId = headingRes.results[0].id;

          const totalIssues = parseInt(mediaData.comicIssues, 10) || 6;
          const issueChildren = [];
          for (let iss = 1; iss <= Math.min(totalIssues, 100); iss++) {
            issueChildren.push({
              object: 'block',
              type: 'to_do',
              to_do: {
                rich_text: [{ type: 'text', text: { content: `Issue #${iss}: Chapter ${iss}` } }],
                checked: false
              }
            });
          }

          for (let offset = 0; offset < issueChildren.length; offset += 50) {
            const chunk = issueChildren.slice(offset, offset + 50);
            await notion.blocks.children.append({ block_id: headingId, children: chunk });
          }
          continue;
        }
      }

      // Achievement/Chapters toggle copy
      if (block.has_children) {
        const headingRes = await notion.blocks.children.append({
          block_id: targetPageId,
          children: [newBlock]
        });
        const headingId = headingRes.results[0].id;

        const toggleChildren = (childrenMap[block.id] || []).map(c => cleanBlock(c));
        if (toggleChildren.length > 0) {
          await notion.blocks.children.append({ block_id: headingId, children: toggleChildren });
        }
        continue;
      }

      await notion.blocks.children.append({ block_id: targetPageId, children: [newBlock] });
    }

    // Inject the additional expected blocks for books
    if (mediaData.type === 'book') {
      const extraBookBlocks = [
        {
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [{ type: 'text', text: { content: '✨ Key Takeaways' } }] }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: "The ideas worth remembering a year from now. Aim for three to five. If you can't explain them simply, you didn't get them yet." }
            }]
          }
        },
        { object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: [] } },
        { object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: [] } },
        { object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: [] } },
        { object: 'block', type: 'divider', divider: {} },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [{ type: 'text', text: { content: '💬 Quotes' } }] }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: "Lines you'd underline if this were a paperback. Verbatim only." }
            }]
          }
        },
        { object: 'block', type: 'quote', quote: { rich_text: [] } },
        { object: 'block', type: 'quote', quote: { rich_text: [] } },
        { object: 'block', type: 'quote', quote: { rich_text: [] } },
        { object: 'block', type: 'divider', divider: {} },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [{ type: 'text', text: { content: '📜 Summary' } }] }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: "The whole book in one paragraph. Imagine telling a friend at dinner what the book is really about, not just what it covers." }
            }]
          }
        },
        {
          object: 'block',
          type: 'callout',
          callout: {
            rich_text: [],
            icon: { type: 'emoji', emoji: '💡' }
          }
        },
        { object: 'block', type: 'divider', divider: {} },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [{ type: 'text', text: { content: '🧠 Overall Thoughts' } }] }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: "What you actually felt. What surprised you. What you disagreed with. Where the book is strong, where it's thin. Write to yourself, not to an audience." }
            }]
          }
        },
        { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [] } },
        { object: 'block', type: 'divider', divider: {} },
        {
          object: 'block',
          type: 'heading_2',
          heading_2: { rich_text: [{ type: 'text', text: { content: '✅ Action Items' } }] }
        },
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              type: 'text',
              text: { content: "The whole point. If nothing changes after reading, the book was entertainment. Make these small, specific, and dated." }
            }]
          }
        },
        { object: 'block', type: 'to_do', to_do: { rich_text: [], checked: false } },
        { object: 'block', type: 'to_do', to_do: { rich_text: [], checked: false } },
        { object: 'block', type: 'to_do', to_do: { rich_text: [], checked: false } }
      ];
      console.log(`📚 Appending ${extraBookBlocks.length} extra book layout blocks...`);
      await notion.blocks.children.append({
        block_id: targetPageId,
        children: extraBookBlocks
      });
    }

    console.log(`✓ Duplication finished successfully for ${targetPageId}`);
  } catch (err) {
    console.error(`❌ Error duplicating blocks for ${targetPageId}:`, err.message);
  }
}

// ─── Notion OAuth & Database Mapping Endpoints ───────────────────────────────

// Helper: Fetch all accessible databases (with paginated search, child_database block inspection, + direct ID fallback)
async function getAllAccessibleDatabases(userNotion) {
  const databases = [];
  const foundDbIds = new Set();

  try {
    // 1. Paginated Search (unfiltered to catch both top-level databases and parent pages)
    let hasMore = true;
    let startCursor = undefined;
    const pagesToScan = [];

    while (hasMore) {
      const searchParams = { page_size: 100 };
      if (startCursor) searchParams.start_cursor = startCursor;

      const response = await userNotion.search(searchParams);
      
      for (const item of response.results) {
        if (item.object === 'database') {
          const normId = item.id.replace(/-/g, '').toLowerCase();
          if (!foundDbIds.has(normId)) {
            foundDbIds.add(normId);
            databases.push(item);
          }
        } else if (item.object === 'page') {
          pagesToScan.push(item);
        }
      }

      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }

    console.log(`🔍 Search returned ${databases.length} direct databases and ${pagesToScan.length} pages to scan for child databases.`);

    // 2. Scan child blocks of accessible pages for inline/child databases
    for (const page of pagesToScan) {
      try {
        const blocksRes = await userNotion.blocks.children.list({ block_id: page.id, page_size: 100 });
        for (const block of blocksRes.results) {
          if (block.type === 'child_database') {
            const normId = block.id.replace(/-/g, '').toLowerCase();
            if (!foundDbIds.has(normId)) {
              try {
                const fullDb = await userNotion.databases.retrieve({ database_id: block.id });
                foundDbIds.add(normId);
                databases.push(fullDb);
                const title = fullDb.title?.map(t => t.plain_text).join('') || block.child_database?.title || 'Untitled Database';
                console.log(`✓ Discovered inline child database: "${title}" (${fullDb.id}) inside page ${page.id}`);
              } catch (err) {
                console.warn(`⚠️ Could not retrieve child database ${block.id}:`, err.message);
              }
            }
          }
        }
      } catch (_) {
        // Skip pages where blocks cannot be listed
      }
    }

    // 3. Direct ID Fallback check for default template databases
    const defaultCheckIds = [
      '36dd0aaf-19d0-8007-92e7-dca0434c570c', // Anime Library
      '370d0aaf-19d0-8121-a36f-f3dfcc914532', // Manga Library
      '36fd0aaf-19d0-815b-b5d3-d51ed587a7d1', // Games Library
      '371d0aaf-19d0-81c5-9b14-fbc0c52b0040', // Comics Library
      '7ab34024-5e7e-4b22-a368-5608e103c0aa', // Movie Library
      '36dd0aaf-19d0-8123-893f-cbaf9bff624a', // Series Library
      '8b2780bf-d844-42d8-bcd9-5223152c0ece'  // Books Library
    ];

    for (const id of defaultCheckIds) {
      const normId = id.replace(/-/g, '').toLowerCase();
      if (!foundDbIds.has(normId)) {
        try {
          console.log(`🔍 Checking direct access to default database ${id}...`);
          const db = await userNotion.databases.retrieve({ database_id: id });
          foundDbIds.add(normId);
          databases.push(db);
          const dbTitle = db.title?.map(t => t.plain_text).join('') || 'Untitled Database';
          console.log(`✓ Resolved default database via direct retrieve: "${dbTitle}" (${db.id})`);
        } catch (_) {}
      }
    }

    console.log(`✅ Deep database scan complete. Total accessible databases found: ${databases.length}`);
    return databases;
  } catch (err) {
    console.error('❌ Error in deep database scan:', err.message);
    return databases;
  }
}

// Helper: Auto-detect workspace mappings based on titles + property signatures
// Helper: Auto-detect workspace mappings based on titles, property signatures, and default IDs
function autoDetectMappings(databases) {
  const mappings = {
    movie: null,
    tv: null,
    book: null,
    anime: null,
    manga: null,
    game: null,
    comic: null
  };

  const DEFAULT_MAP_IDS = {
    movie: '7ab34024-5e7e-4b22-a368-5608e103c0aa',
    tv: '36dd0aaf-19d0-8123-893f-cbaf9bff624a',
    book: '8b2780bf-d844-42d8-bcd9-5223152c0ece',
    anime: '36dd0aaf-19d0-8007-92e7-dca0434c570c',
    manga: '370d0aaf-19d0-8121-a36f-f3dfcc914532',
    game: '36fd0aaf-19d0-815b-b5d3-d51ed587a7d1',
    comic: '371d0aaf-19d0-81c5-9b14-fbc0c52b0040'
  };

  const KEYWORDS = {
    movie: ['movies', 'movie', 'film', 'cinema'],
    tv: ['series', 'tv shows', 'tv show', 'tvshow', 'tv'],
    book: ['books', 'book', 'reading', 'novel', 'library'],
    anime: ['anime', 'mal', 'myanimelist'],
    manga: ['manga', 'manhwa'],
    game: ['games', 'game', 'video game', 'steam'],
    comic: ['comics', 'comic', 'graphic novel']
  };

  // Pass 1: Match by explicit title keywords
  for (const [category, keywords] of Object.entries(KEYWORDS)) {
    for (const db of databases) {
      if (mappings[category]) break;
      if (Object.values(mappings).includes(db.id)) continue;
      const title = (db.title?.map(t => t.plain_text).join('') || '').toLowerCase();
      if (keywords.some(kw => title.includes(kw))) {
        mappings[category] = db.id;
        console.log(`✓ Title match: Category "${category}" mapped to "${title}" (${db.id})`);
      }
    }
  }

  // Pass 2: Match by property signatures for any unmapped category
  for (const db of databases) {
    if (Object.values(mappings).includes(db.id)) continue;
    const props = Object.keys(db.properties || {}).map(p => p.toLowerCase().trim());

    if (!mappings.anime && (props.includes('mal score') || (props.includes('episodes watched') && props.includes('studio')))) {
      mappings.anime = db.id;
    } else if (!mappings.manga && (props.includes('publishingstatus') || (props.includes('chapters') && props.includes('volumes')))) {
      mappings.manga = db.id;
    } else if (!mappings.game && (props.includes('metacritic') || (props.includes('platform') && props.includes('developer')))) {
      mappings.game = db.id;
    } else if (!mappings.comic && (props.includes('issues') || (props.includes('writer') && props.includes('artist')))) {
      mappings.comic = db.id;
    } else if (!mappings.book && (props.includes('total pages') || props.includes('pages read') || props.includes('isbn'))) {
      mappings.book = db.id;
    } else if (!mappings.tv && (props.includes('seasons') || (props.includes('episodes watched') && props.includes('total episodes')))) {
      mappings.tv = db.id;
    } else if (!mappings.movie && (props.includes('director') || (props.includes('imdbrating') && props.includes('runtime')))) {
      mappings.movie = db.id;
    }
  }

  // Pass 3: Check default template IDs
  for (const [category, defaultId] of Object.entries(DEFAULT_MAP_IDS)) {
    if (!mappings[category]) {
      const match = databases.find(db => db.id.replace(/-/g, '').toLowerCase() === defaultId.replace(/-/g, '').toLowerCase());
      if (match) {
        mappings[category] = match.id;
        console.log(`✓ Default ID match: Category "${category}" mapped to "${match.title?.map(t => t.plain_text).join('') || 'Untitled'}" (${match.id})`);
      }
    }
  }

  return mappings;
}

// GET /api/notion/login: Redirects to Notion OAuth consent screen
app.get('/api/notion/login', (req, res) => {
  const clientId = process.env.NOTION_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send('NOTION_CLIENT_ID is not configured in .env');
  }
  const redirectUri = `${process.env.WIDGET_BASE_URL || 'http://localhost:8080'}/api/notion/callback`;
  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(notionAuthUrl);
});

// GET /api/notion/callback: Handles the auth code redirection, exchanges for token, and auto-detects mappings
app.get('/api/notion/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('Notion OAuth callback error:', error);
    return res.status(400).send(`OAuth Error: ${error}`);
  }

  if (!code) {
    return res.status(400).send('OAuth Error: Missing authorization code');
  }

  try {
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = `${process.env.WIDGET_BASE_URL || 'http://localhost:8080'}/api/notion/callback`;

    console.log('🔄 Trading authorization code for Notion access token...');
    const tokenResponse = await axios.post('https://api.notion.com/v1/oauth/token', {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      }
    });

    const { access_token, workspace_name, workspace_id } = tokenResponse.data;
    console.log(`✓ Workspace authenticated: ${workspace_name} (${workspace_id})`);

    // Fetch and auto-detect database mappings
    console.log('🔍 Auto-detecting database mappings in workspace...');
    const userNotion = new Client({ auth: access_token });
    const userDatabases = await getAllAccessibleDatabases(userNotion);
    const mappings = autoDetectMappings(userDatabases);
    
    console.log('✓ Auto-detection complete. Mappings found:', mappings);

    await connectionsDb.saveConnection(workspace_id, {
      accessToken: access_token,
      workspaceName: workspace_name,
      databaseMappings: mappings
    });

    res.redirect(`/setup.html?workspace_id=${workspace_id}&is_popup=true`);
  } catch (err) {
    const errorDetails = err.response?.data || err.message;
    console.error('❌ Error exchanging Notion code for token:', errorDetails);
    res.status(500).send(`Authentication failed: ${err.response?.data?.error_description || err.message}`);
  }
});

// GET /api/notion/config: Retrieve existing database mapping configuration
app.get('/api/notion/config', async (req, res) => {
  const { workspace_id } = req.query;
  if (!workspace_id) {
    return res.status(400).json({ error: 'Workspace ID missing' });
  }

  const connection = await connectionsDb.getConnection(workspace_id);
  if (!connection) {
    return res.status(404).json({ error: 'Workspace connection not found' });
  }

  res.json({
    workspaceName: connection.workspaceName,
    databaseMappings: connection.databaseMappings || {}
  });
});

// GET /api/notion/databases: Search and return all accessible databases in workspace
app.get('/api/notion/databases', async (req, res) => {
  const { workspace_id } = req.query;
  if (!workspace_id) {
    return res.status(400).json({ error: 'Workspace ID missing' });
  }

  const connection = await connectionsDb.getConnection(workspace_id);
  if (!connection || !connection.accessToken) {
    return res.status(401).json({ error: 'Workspace not authenticated or connected' });
  }

  try {
    const userNotion = new Client({ auth: connection.accessToken });
    console.log(`🔍 Listing databases for workspace ${connection.workspaceName}...`);
    
    const fullDatabases = await getAllAccessibleDatabases(userNotion);
    const databases = fullDatabases.map(db => {
      const title = db.title?.map(t => t.plain_text).join('') || 'Untitled Database';
      return {
        id: db.id,
        title: title
      };
    });

    res.json(databases);
  } catch (err) {
    console.error('❌ Error listing Notion databases:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notion/map: Save category mappings for user's databases
app.post('/api/notion/map', async (req, res) => {
  const { workspaceId, mappings } = req.body;
  if (!workspaceId || !mappings) {
    return res.status(400).json({ error: 'Missing workspaceId or mappings' });
  }

  const success = await connectionsDb.updateMappings(workspaceId, mappings);
  if (!success) {
    return res.status(500).json({ error: 'Failed to update database mappings' });
  }

  res.json({ success: true });
});

// POST /api/notion/disconnect: Disconnect workspace or specific category mapping
app.post('/api/notion/disconnect', async (req, res) => {
  try {
    const { workspaceId, type } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId' });
    }

    if (!type || type === 'all') {
      await connectionsDb.deleteConnection(workspaceId);
      return res.json({ success: true, connectionDeleted: true });
    } else {
      const conn = await connectionsDb.getConnection(workspaceId);
      if (conn && conn.databaseMappings) {
        delete conn.databaseMappings[type];
        await connectionsDb.updateMappings(workspaceId, conn.databaseMappings);
      }
      return res.json({ success: true, connectionDeleted: false });
    }
  } catch (err) {
    console.error('❌ Error disconnecting Notion workspace:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Search APIs proxies ──────────────────────────────────────────────────────

// Anime Search (Jikan MAL API)
app.get('/api/search/anime', setEdgeCache, (req, res, next) => checkFeatureFlag('anime', res, next), async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Query missing' });
    const response = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=10`);
    const results = response.data.data.map(item => ({
      title: item.title_english || item.title,
      year: item.aired?.from ? new Date(item.aired.from).getFullYear() : null,
      cover: formatCoverUrl(item.images?.jpg?.large_image_url || item.images?.jpg?.image_url),
      synopsis: item.synopsis || '',
      genres: item.genres?.map(g => g.name) || [],
      metadata: {
        studio: item.studios?.map(s => s.name).join(', ') || 'N/A',
        score: item.score || null,
        episodes: item.episodes || null,
        url: item.url || '',
        format: item.type || 'TV',
        aired: item.aired?.string || 'N/A'
      }
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manga Search (Jikan MAL API)
app.get('/api/search/manga', setEdgeCache, (req, res, next) => checkFeatureFlag('manga', res, next), async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Query missing' });
    const response = await axios.get(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(q)}&limit=10`);
    const results = response.data.data.map(item => ({
      title: item.title_english || item.title,
      year: item.published?.from ? new Date(item.published.from).getFullYear() : null,
      cover: formatCoverUrl(item.images?.jpg?.large_image_url || item.images?.jpg?.image_url),
      synopsis: item.synopsis || '',
      genres: item.genres?.map(g => g.name) || [],
      metadata: {
        author: item.authors?.map(a => a.name.replace(/,\s*/g, ' ').trim()).join(',') || 'N/A',
        volumes: item.volumes || null,
        chapters: item.chapters || null,
        url: item.url || '',
        score: item.score || null,
        status: item.status || 'Finished',
        malId: item.mal_id
      }
    }));
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TV Show Search (TVMaze API)
app.get('/api/search/tv', setEdgeCache, (req, res, next) => checkFeatureFlag('tv', res, next), async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Query missing' });
    const response = await axios.get(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
    const results = response.data.slice(0, 10).map(item => {
      const show = item.show;
      return {
        title: show.name,
        year: show.premiered ? new Date(show.premiered).getFullYear() : null,
        cover: formatCoverUrl(show.image?.original || show.image?.medium),
        synopsis: (show.summary || '').replace(/<[^>]*>/g, ''), // Strip html tags
        genres: show.genres || [],
        metadata: {
          id: show.id,
          network: show.network?.name || show.webChannel?.name || 'N/A',
          rating: show.rating?.average || null,
          runtime: show.runtime || null,
          status: show.status || 'N/A'
        }
      };
    });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Movie Search (OMDB API using free key)
app.get('/api/search/movie', setEdgeCache, (req, res, next) => checkFeatureFlag('movie', res, next), async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Query missing' });
    const searchResponse = await axios.get(`http://www.omdbapi.com/?s=${encodeURIComponent(q)}&type=movie&apikey=${OMDB_API_KEY}`);
    if (searchResponse.data.Response === 'False') return res.json([]);

    const moviesList = searchResponse.data.Search.slice(0, 8);
    const results = [];

    // Fetch full details for each to get genres/synopsis
    for (const movieSummary of moviesList) {
      try {
        const detailRes = await axios.get(`http://www.omdbapi.com/?i=${movieSummary.imdbID}&apikey=${OMDB_API_KEY}`);
        const m = detailRes.data;
        if (m.Response !== 'False') {
          results.push({
            title: m.Title,
            year: parseInt(m.Year, 10) || null,
            cover: formatCoverUrl(m.Poster),
            synopsis: m.Plot || '',
            genres: m.Genre && m.Genre !== 'N/A' ? m.Genre.split(',').map(g => g.trim()) : [],
            metadata: {
              director: m.Director || 'N/A',
              actors: m.Actors || 'N/A',
              writer: m.Writer || 'N/A',
              rating: parseFloat(m.imdbRating) || null,
              runtime: parseInt((m.Runtime || '').replace(' min', ''), 10) || null
            }
          });
        }
      } catch (_) {}
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Game Search (Steam Store Search & App Details keyless APIs)
app.get('/api/search/game', setEdgeCache, (req, res, next) => checkFeatureFlag('game', res, next), async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Query missing' });
    
    // 1. Query Steam Store Search API
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(q)}&l=english&cc=US`;
    const searchRes = await axios.get(searchUrl, { timeout: 8000 });
    
    if (!searchRes.data || !searchRes.data.items || searchRes.data.items.length === 0) {
      return res.json([]);
    }
    
    // Take top 8 results
    const items = searchRes.data.items.slice(0, 8);
    
    // 2. Fetch app details in parallel for accurate metadata
    const detailsPromises = items.map(async (item) => {
      try {
        const appId = item.id;
        const detailsRes = await axios.get(`https://store.steampowered.com/api/appdetails?appids=${appId}`, { timeout: 5000 });
        if (detailsRes.data && detailsRes.data[appId]?.success) {
          const data = detailsRes.data[appId].data;
          
          // Build library cover URL and verify with axios.head (or fallback)
          let cover = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
          try {
            await axios.head(cover, { timeout: 2500 });
          } catch (_) {
            cover = data.header_image || data.capsule_image || item.tiny_image || null;
          }
          
          // Parse release year
          let year = null;
          if (data.release_date?.date) {
            const match = data.release_date.date.match(/\d{4}/);
            if (match) year = parseInt(match[0], 10);
          }
          
          // Map platforms
          const platforms = [];
          if (data.platforms?.windows) platforms.push('PC');
          if (data.platforms?.mac) platforms.push('Mac');
          if (data.platforms?.linux) platforms.push('Linux');
          
          return {
            title: data.name || item.name,
            year: year,
            cover: formatCoverUrl(cover),
            synopsis: (data.short_description || data.about_the_game || '').replace(/<[^>]*>/g, ''), // strip HTML
            genres: data.genres?.map(g => g.description) || ['Action', 'Adventure'],
            metadata: {
              developer: data.developers?.join(', ') || 'N/A',
              publisher: data.publishers?.join(', ') || 'N/A',
              platforms: platforms.length > 0 ? platforms : ['PC'],
              score: data.metacritic?.score || null,
              steamAppID: appId
            }
          };
        }
      } catch (err) {
        console.warn(`⚠️ Failed to fetch Steam details for ${item.name}:`, err.message);
      }
      
      // Fallback if detail query fails, construct basic response using search item info
      let cover = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${item.id}/library_600x900.jpg`;
      return {
        title: item.name,
        year: null,
        cover: formatCoverUrl(cover),
        synopsis: `Video game "${item.name}". Search online for details.`,
        genres: ['Action', 'Adventure'],
        metadata: {
          developer: 'N/A',
          publisher: 'N/A',
          platforms: item.platforms?.windows ? ['PC'] : ['PC'],
          score: item.metascore ? parseInt(item.metascore, 10) : null,
          steamAppID: item.id
        }
      };
    });
    
    const detailsResults = await Promise.all(detailsPromises);
    res.json(detailsResults);
  } catch (err) {
    console.error('❌ Steam Game Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Book & Comic Search (Google Books API with Open Library fallback)
app.get('/api/search/book', setEdgeCache, (req, res, next) => checkFeatureFlag('book', res, next), async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Query missing' });
    
    try {
      const response = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10`, { timeout: 6000 });
      if (response.data.items) {
        const results = response.data.items.map(item => {
          const vol = item.volumeInfo;
          let cover = vol.imageLinks?.extraLarge || vol.imageLinks?.large || vol.imageLinks?.medium || vol.imageLinks?.thumbnail;
          if (cover && cover.startsWith('http:')) cover = cover.replace('http:', 'https:');
          
          return {
            title: vol.title,
            year: vol.publishedDate ? parseInt(vol.publishedDate.split('-')[0], 10) : null,
            cover: formatCoverUrl(cover),
            synopsis: vol.description || '',
            genres: vol.categories || ['Fiction'],
            metadata: {
              author: vol.authors?.join(', ') || 'Unknown Author',
              publisher: vol.publisher || 'N/A',
              pages: vol.pageCount || null
            }
          };
        });
        return res.json(results);
      }
    } catch (gError) {
      console.warn('⚠️ Google Books API failed, falling back to Open Library:', gError.message);
    }

    // Open Library Fallback
    const olRes = await axios.get(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=key,title,author_name,cover_i,first_publish_year,publisher,number_of_pages_median`, { timeout: 8000 });
    if (!olRes.data.docs) return res.json([]);
    
    const results = olRes.data.docs.map(doc => {
      const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null;
      return {
        title: doc.title,
        year: doc.first_publish_year || null,
        cover: formatCoverUrl(cover),
        synopsis: `Book "${doc.title}". Search online for plot and details.`,
        genres: ['Fiction'],
        metadata: {
          author: doc.author_name?.join(', ') || 'Unknown Author',
          publisher: doc.publisher?.[0] || 'N/A',
          pages: doc.number_of_pages_median || null
        }
      };
    });
    res.json(results);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Comic Search (Open Library API keyless)
app.get('/api/search/comic', setEdgeCache, (req, res, next) => checkFeatureFlag('comic', res, next), async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: 'Query missing' });

    const olRes = await axios.get(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=key,title,author_name,cover_i,first_publish_year,publisher`, { timeout: 15000 });
    if (!olRes.data.docs) return res.json([]);
    
    const results = olRes.data.docs.map(doc => {
      const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null;
      const olKey = doc.key ? doc.key.replace('/works/', '') : null;
      return {
        title: doc.title,
        year: doc.first_publish_year || null,
        cover: formatCoverUrl(cover),
        synopsis: `Comic "${doc.title}". Search online for plot and details.`,
        genres: ['Action', 'Sci-Fi'], // Default genre for comics
        metadata: {
          author: doc.author_name?.join(', ') || 'Unknown Author',
          publisher: doc.publisher?.[0] || 'N/A',
          olKey: olKey,
          volumes: 1,
          issues: 6
        }
      };
    });
    res.json(results);

  } catch (err) {
    console.error('❌ Comic search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Add Page to Notion Endpoint ──────────────────────────────────────────────

app.post('/api/add', async (req, res) => {
  let { workspaceId, type, title, cover, year, genres, synopsis, metadata } = req.body;
  
  if (!type || !title) {
    return res.status(400).json({ error: 'Missing type or title' });
  }

  // Upload cover image to Vercel Blob if configured
  if (cover) {
    try {
      const blobUrl = await uploadCoverToBlob(cover, title, type);
      if (blobUrl) {
        cover = blobUrl;
      }
    } catch (err) {
      console.warn('⚠️ Cover upload skipped or failed:', err.message);
    }
  }

  if (!workspaceId) {
    return res.status(400).json({ error: 'Workspace ID is missing' });
  }

  const connection = await connectionsDb.getConnection(workspaceId);
  if (!connection || !connection.accessToken) {
    return res.status(401).json({ error: 'Notion workspace not linked. Please configure it.' });
  }

  const databaseId = connection.databaseMappings?.[type];
  if (!databaseId) {
    return res.status(400).json({ error: `Notion database for media type "${type}" has not been mapped yet. Please go to setup page.` });
  }

  const userNotion = new Client({ auth: connection.accessToken });
  const cleanedTitle = cleanMediaTitle(title, type);

  try {
    console.log(`➕ Retrieving schema for Notion database: ${databaseId}...`);
    const db = await userNotion.databases.retrieve({ database_id: databaseId });
    const existingProps = Object.keys(db.properties);
    console.log(`✓ Retrieved database schema. Properties found: ${existingProps.join(', ')}`);

    // Dynamically locate the title-type property
    let titleProp = 'Title';
    for (const [name, desc] of Object.entries(db.properties)) {
      if (desc.type === 'title') {
        titleProp = name;
        break;
      }
    }

    const properties = {
      [titleProp]: {
        title: [{ text: { content: cleanedTitle } }]
      }
    };

    // Global properties
    if (synopsis) {
      setSafeProperty(properties, db, 'Synopsis', synopsis.substring(0, 1900));
    }

    // Type-specific mappings
    if (type === 'anime') {
      setSafeProperty(properties, db, 'Status', 'Inbox');
      if (metadata.studio) setSafeProperty(properties, db, 'Studio', metadata.studio);
      if (metadata.score) setSafeProperty(properties, db, 'MAL Score', metadata.score);
      if (metadata.url) setSafeProperty(properties, db, 'MAL URL', metadata.url);
      if (metadata.episodes) setSafeProperty(properties, db, 'Total Episodes', metadata.episodes);
      if (genres && genres.length > 0) setSafeProperty(properties, db, 'Genres', genres.slice(0, 6));
      if (cover) {
        const coverPropName = existingProps.includes('Cover Image') ? 'Cover Image' : 'Cover';
        setSafeProperty(properties, db, coverPropName, cover);
      }
    } 
    else if (type === 'manga') {
      setSafeProperty(properties, db, 'Status', 'Inbox');
      if (metadata.author) setSafeProperty(properties, db, 'Authors', metadata.author);
      if (metadata.volumes) setSafeProperty(properties, db, 'Volumes', metadata.volumes);
      if (metadata.chapters) setSafeProperty(properties, db, 'Chapters', metadata.chapters);
      if (metadata.score) setSafeProperty(properties, db, 'MAL Score', metadata.score);
      if (metadata.url) setSafeProperty(properties, db, 'MAL URL', metadata.url);
      if (metadata.malId) setSafeProperty(properties, db, 'MAL ID', metadata.malId);
      if (metadata.status) setSafeProperty(properties, db, 'PublishingStatus', metadata.status);
      if (genres && genres.length > 0) setSafeProperty(properties, db, 'Genres', genres.slice(0, 6));
      if (cover) {
        const coverPropName = existingProps.includes('Cover Image') ? 'Cover Image' : 'Cover';
        setSafeProperty(properties, db, coverPropName, cover);
      }
    }
    else if (type === 'game') {
      setSafeProperty(properties, db, 'Status', 'Inbox');
      if (year) setSafeProperty(properties, db, 'ReleaseYear', year);
      if (metadata.developer) setSafeProperty(properties, db, 'Developer', metadata.developer);
      if (metadata.publisher) setSafeProperty(properties, db, 'Publisher', metadata.publisher);
      if (metadata.score) setSafeProperty(properties, db, 'Metacritic', metadata.score);
      if (metadata.platforms && metadata.platforms.length > 0) setSafeProperty(properties, db, 'Platform', metadata.platforms.slice(0, 5));
      if (genres && genres.length > 0) setSafeProperty(properties, db, 'Genre', genres.slice(0, 6));
      if (cover) {
        const coverPropName = existingProps.includes('Cover Image') ? 'Cover Image' : 'Cover';
        setSafeProperty(properties, db, coverPropName, cover);
      }
    }
    else if (type === 'movie') {
      setSafeProperty(properties, db, 'Status', 'Inbox');
      if (year) setSafeProperty(properties, db, 'ReleaseYear', year);
      if (metadata.director) setSafeProperty(properties, db, 'Director', metadata.director);
      if (metadata.rating) setSafeProperty(properties, db, 'IMDbRating', metadata.rating);
      if (metadata.runtime) setSafeProperty(properties, db, 'Runtime', metadata.runtime);
      if (genres && genres.length > 0) setSafeProperty(properties, db, 'Genre', genres.slice(0, 6));
      if (cover) {
        const coverPropName = existingProps.includes('Files & media') ? 'Files & media' : (existingProps.includes('Cover Image') ? 'Cover Image' : 'Cover');
        setSafeProperty(properties, db, coverPropName, cover);
      }
    }
    else if (type === 'tv') {
      setSafeProperty(properties, db, 'Status', 'Inbox');
      if (year) setSafeProperty(properties, db, 'ReleaseYear', year);
      if (metadata.rating) setSafeProperty(properties, db, 'IMDbRating', metadata.rating);
      if (metadata.runtime) setSafeProperty(properties, db, 'Runtime', metadata.runtime);
      if (metadata.seasons) setSafeProperty(properties, db, 'Seasons', metadata.seasons);
      if (metadata.episodes) setSafeProperty(properties, db, 'Total Episodes', metadata.episodes);
      if (genres && genres.length > 0) setSafeProperty(properties, db, 'Genre', genres.slice(0, 6));
    }
    else if (type === 'comic') {
      setSafeProperty(properties, db, 'Status', 'Inbox');
      if (year) setSafeProperty(properties, db, 'ReleaseYear', year);
      if (metadata.author) setSafeProperty(properties, db, 'Writer', metadata.author);
      if (metadata.artist) setSafeProperty(properties, db, 'Artist', metadata.artist);
      if (metadata.publisher) setSafeProperty(properties, db, 'Publisher', metadata.publisher);
      if (metadata.volumes) setSafeProperty(properties, db, 'Volumes', metadata.volumes);
      if (metadata.issues) setSafeProperty(properties, db, 'Issues', metadata.issues);
      if (genres && genres.length > 0) setSafeProperty(properties, db, 'Genres', genres.slice(0, 6));
      if (cover) {
        const coverPropName = existingProps.includes('Cover Image') ? 'Cover Image' : 'Cover';
        setSafeProperty(properties, db, coverPropName, cover);
      }
    }
    else if (type === 'book') {
      setSafeProperty(properties, db, 'Status', 'Inbox');
      const bookType = detectBookType(genres, title, synopsis);
      setSafeProperty(properties, db, 'Type', bookType);
      if (metadata.pages) setSafeProperty(properties, db, 'Total Pages ', metadata.pages);
      if (cover) {
        const coverPropName = existingProps.includes('Cover') ? 'Cover' : 'Cover Image';
        setSafeProperty(properties, db, coverPropName, cover);
      }

      // Resolve Book Relations (Author + Genre) only if the relations properties exist in the DB schema
      if (metadata.author && existingProps.includes('Author') && db.properties['Author'].type === 'relation') {
        let authorId = null;
        const userAuthorsDbId = db.properties['Author'].relation.database_id;
        try {
          // Search Author DB
          const searchAuthorRes = await userNotion.databases.query({
            database_id: userAuthorsDbId,
            filter: { property: 'Name', title: { equals: metadata.author } }
          });
          
          if (searchAuthorRes.results.length > 0) {
            authorId = searchAuthorRes.results[0].id;
          } else {
            // Create Author
            const newAuthor = await userNotion.pages.create({
              parent: { database_id: userAuthorsDbId },
              properties: { Name: { title: [{ text: { content: metadata.author } }] } }
            });
            authorId = newAuthor.id;
          }
          if (authorId) properties['Author'] = { relation: [{ id: authorId }] };
        } catch (relationErr) {
          console.warn('⚠️ Failed to resolve Book Author relation:', relationErr.message);
        }
      }

      if (genres && genres.length > 0 && existingProps.includes('Genre') && db.properties['Genre'].type === 'relation') {
        let genreId = null;
        const genreName = genres[0];
        const userGenresDbId = db.properties['Genre'].relation.database_id;
        try {
          // Search Genre DB
          const searchGenreRes = await userNotion.databases.query({
            database_id: userGenresDbId,
            filter: { property: 'Name', title: { equals: genreName } }
          });
          
          if (searchGenreRes.results.length > 0) {
            genreId = searchGenreRes.results[0].id;
          } else {
            // Create Genre
            const newGenre = await userNotion.pages.create({
              parent: { database_id: userGenresDbId },
              properties: { Name: { title: [{ text: { content: genreName } }] } }
            });
            genreId = newGenre.id;
          }
          if (genreId) properties['Genre'] = { relation: [{ id: genreId }] };
        } catch (relationErr) {
          console.warn('⚠️ Failed to resolve Book Genre relation:', relationErr.message);
        }
      }
    }

    // Build Notion Page payload
    const pagePayload = {
      parent: { database_id: databaseId },
      properties
    };

    if (cover) {
      pagePayload.cover = { type: 'external', external: { url: cover } };
    }

    // Insert Page
    const page = await userNotion.pages.create(pagePayload);

    // Asynchronously update page icon and copy template structure
    const templateId = TEMPLATE_IDS[type];
    if (templateId) {
      (async () => {
        try {
          // Find trailer link dynamically using cleaned title
          const trailerUrl = (type === 'movie' || type === 'tv' || type === 'anime')
            ? await getYoutubeTrailer(cleanedTitle, year)
            : null;

          // Fetch type-specific dynamic data
          let tvMazeDetails = { seasonsCount: 0, episodesCount: 0, episodesList: [] };
          let malCharacters = [];
          let malEpisodes = [];

          if (type === 'tv') {
            let showId = metadata.id;
            if (showId) {
              try {
                const response = await axios.get(`https://api.tvmaze.com/shows/${showId}?embed[]=seasons&embed[]=episodes&embed[]=cast&embed[]=crew`);
                if (response.data && response.data._embedded) {
                  const seasons = response.data._embedded.seasons;
                  const episodes = response.data._embedded.episodes;
                  const cast = response.data._embedded.cast || [];
                  const crew = response.data._embedded.crew || [];
                  
                  const actorsList = cast.slice(0, 5).map(c => c.person.name).join(', ');
                  let writerList = crew.filter(cr => cr.type === 'Creator' || cr.type === 'Writer').map(cr => cr.person.name).join(', ');
                  if (!writerList) {
                    writerList = crew.filter(cr => cr.type === 'Executive Producer').slice(0, 2).map(cr => cr.person.name).join(', ');
                  }
                  const directorsList = crew.filter(cr => cr.type === 'Director').slice(0, 2).map(cr => cr.person.name).join(', ');

                  tvMazeDetails = {
                    seasonsCount: seasons.length,
                    episodesCount: episodes.length,
                    episodesList: episodes,
                    actors: actorsList || 'N/A',
                    writer: writerList || 'N/A',
                    director: directorsList || 'N/A'
                  };
                }
              } catch (err) {
                console.error('TVMaze fetch by ID failed, trying search fallback:', err.message);
              }
            }
            if (tvMazeDetails.episodesList.length === 0) {
              try {
                const response = await axios.get(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanedTitle)}&embed[]=seasons&embed[]=episodes&embed[]=cast&embed[]=crew`);
                if (response.data && response.data._embedded) {
                  const seasons = response.data._embedded.seasons;
                  const episodes = response.data._embedded.episodes;
                  const cast = response.data._embedded.cast || [];
                  const crew = response.data._embedded.crew || [];
                  
                  const actorsList = cast.slice(0, 5).map(c => c.person.name).join(', ');
                  let writerList = crew.filter(cr => cr.type === 'Creator' || cr.type === 'Writer').map(cr => cr.person.name).join(', ');
                  if (!writerList) {
                    writerList = crew.filter(cr => cr.type === 'Executive Producer').slice(0, 2).map(cr => cr.person.name).join(', ');
                  }
                  const directorsList = crew.filter(cr => cr.type === 'Director').slice(0, 2).map(cr => cr.person.name).join(', ');

                  tvMazeDetails = {
                    seasonsCount: seasons.length,
                    episodesCount: episodes.length,
                    episodesList: episodes,
                    actors: actorsList || 'N/A',
                    writer: writerList || 'N/A',
                    director: directorsList || 'N/A'
                  };
                }
              } catch (_) {}
            }
          } 
          else if (type === 'anime') {
            let malId = null;
            if (metadata.url) {
              const match = metadata.url.match(/\/anime\/(\d+)/);
              if (match) malId = match[1];
            }
            if (malId) {
              // Fetch Characters
              try {
                const charRes = await axios.get(`https://api.jikan.moe/v4/anime/${malId}/characters`);
                if (charRes.data && charRes.data.data) {
                  const mainChars = charRes.data.data.filter(c => c.role === 'Main' || c.role === 'Supporting').slice(0, 6);
                  malCharacters = mainChars.map(c => {
                    const jaVA = c.voice_actors?.find(va => va.language === 'Japanese');
                    return {
                      name: c.character.name.replace(/, /g, ' '),
                      va: jaVA ? jaVA.person.name.replace(/, /g, ' ') : 'N/A'
                    };
                  });
                }
              } catch (err) {
                console.error('Anime characters fetch failed:', err.message);
              }

              // Sleep 1000ms to respect rate limit
              await sleep(1000);

              // Fetch Episodes
              try {
                const epRes = await axios.get(`https://api.jikan.moe/v4/anime/${malId}/episodes`);
                if (epRes.data && epRes.data.data) {
                  malEpisodes = epRes.data.data.map(ep => ({
                    number: ep.mal_id,
                    name: ep.title
                  }));
                }
              } catch (err) {
                console.error('Anime episodes fetch failed:', err.message);
              }
            }
          }

          let comicDetails = { ratingsAverage: null, description: '' };
          if (type === 'comic') {
            const olKey = metadata.olKey;
            if (olKey) {
              console.log(`➕ Fetching Open Library details for comic ${olKey}...`);
              // Query ratings
              try {
                const ratingsRes = await axios.get(`https://openlibrary.org/works/${olKey}/ratings.json`, { timeout: 4000 });
                if (ratingsRes.data?.summary?.average) {
                  comicDetails.ratingsAverage = parseFloat(ratingsRes.data.summary.average.toFixed(2));
                }
              } catch (err) {
                console.warn('⚠️ Open Library ratings fetch failed:', err.message);
              }

              // Query work details
              try {
                const workRes = await axios.get(`https://openlibrary.org/works/${olKey}.json`, { timeout: 5000 });
                let desc = workRes.data?.description;
                if (desc) {
                  if (typeof desc === 'object') desc = desc.value;
                  comicDetails.description = desc.substring(0, 1900);
                }
              } catch (err) {
                console.warn('⚠️ Open Library description fetch failed:', err.message);
              }
            }
          }

          // Update database properties
          const updateProps = {};
          if (trailerUrl) {
            if (type === 'movie') setSafeProperty(updateProps, db, 'Trailer URL', trailerUrl);
            else if (type === 'tv') setSafeProperty(updateProps, db, 'Trailer', trailerUrl);
          }
          if (type === 'tv') {
            if (tvMazeDetails.seasonsCount > 0) {
              setSafeProperty(updateProps, db, 'Seasons', tvMazeDetails.seasonsCount);
            }
            if (tvMazeDetails.episodesCount > 0) {
              setSafeProperty(updateProps, db, 'Total Episodes', tvMazeDetails.episodesCount);
            }
          }
          if (type === 'comic') {
            if (comicDetails.ratingsAverage) {
              setSafeProperty(updateProps, db, 'Community Rating', comicDetails.ratingsAverage);
            }
            if (metadata.olKey) {
              setSafeProperty(updateProps, db, 'OL Key', metadata.olKey);
            }
            if (comicDetails.description && !synopsis) {
              setSafeProperty(updateProps, db, 'Synopsis', comicDetails.description);
              synopsis = comicDetails.description;
            }
          }

          // Retrieve template details for page icon copy
          const tmpl = await notion.pages.retrieve({ page_id: templateId });
          const updateParams = { page_id: page.id };
          if (tmpl.icon) updateParams.icon = tmpl.icon;
          if (Object.keys(updateProps).length > 0) {
            updateParams.properties = updateProps;
          }
          await userNotion.pages.update(updateParams);

          const mediaData = {
            type,
            title: cleanedTitle,
            synopsis,
            trailerUrl,
            director: metadata.director || (type === 'tv' ? tvMazeDetails.director : undefined),
            actors: metadata.actors || (type === 'tv' ? tvMazeDetails.actors : undefined),
            writer: metadata.writer || (type === 'comic' ? metadata.author : (type === 'tv' ? tvMazeDetails.writer : undefined)),
            artist: metadata.artist || (type === 'comic' ? 'Unknown / Multiple' : undefined),
            author: metadata.author,
            developer: metadata.developer,
            publisher: metadata.publisher,
            releaseYear: year,
            pages: metadata.pages,
            tvMazeDetails,
            malCharacters,
            malEpisodes,
            animeFormat: metadata.format,
            animeStudio: metadata.studio,
            animeAired: metadata.aired,
            animeScore: metadata.score,
            mangaVolumes: metadata.volumes,
            mangaChapters: metadata.chapters,
            mangaStatus: metadata.status,
            comicVolumes: metadata.volumes,
            comicIssues: metadata.issues
          };

          await copyTemplateBlocks(userNotion, templateId, page.id, mediaData);
        } catch (bgErr) {
          console.error('Error applying template block layouts in background:', bgErr.message);
        }
      })();
    }

    // Return success to frontend
    res.json({
      success: true,
      pageId: page.id,
      url: `https://notion.so/${page.id.replace(/-/g, '')}`
    });

  } catch (err) {
    console.error('Notion API page creation failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Notion Search & Add Widget running at http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
