/**
 * import_and_link_books.js
 * Imports the 10,000 most famous books into the Notion Library database.
 * Resolves, creates, and links Author and Genre relations natively.
 * Also repairs empty relations on existing books in place!
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const BOOKS_DB_ID  = '8b2780bfd84442d8bcd95223152c0ece';
const AUTHORS_DB_ID = '367d0aaf-19d0-803e-ac0a-d33d3c82c581';
const GENRES_DB_ID  = '37d28afc-7789-44af-8035-2bb161318e31';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep  = (ms) => new Promise((r) => setTimeout(r, ms));
const isDryRun = process.argv.includes('--dry-run');

// ─── CSV Line Parser ──────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped double quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ─── Extract Pre-Curated Books from import_top_books.js ──────────────────────
function getPreCuratedBooks() {
  try {
    const filePath = path.join(__dirname, 'import_top_books.js');
    if (!fs.existsSync(filePath)) {
      console.warn('⚠️  import_top_books.js not found. Skipping pre-curated books.');
      return [];
    }
    const code = fs.readFileSync(filePath, 'utf8');
    const startIdx = code.indexOf('const BOOKS = [');
    const endIdx = code.indexOf('];', startIdx);
    if (startIdx === -1 || endIdx === -1) {
      console.warn('⚠️  BOOKS array not found in import_top_books.js. Skipping.');
      return [];
    }
    const booksSegment = code.substring(startIdx, endIdx + 2);
    const cleanCode = booksSegment.replace('const BOOKS =', 'module.exports =') + '\n';
    const tempFile = path.join(__dirname, 'temp_books_extract.js');
    fs.writeFileSync(tempFile, cleanCode, 'utf8');
    const books = require(tempFile);
    fs.unlinkSync(tempFile);
    return books;
  } catch (err) {
    console.error('❌ Failed to parse pre-curated books:', err.message);
    return [];
  }
}

// ─── Open Library: fetch cover + synopsis ─────────────────────────────────────
async function fetchBookMeta(title, author) {
  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const res = await axios.get(
      `https://openlibrary.org/search.json?q=${query}&limit=1&fields=key,title,cover_i,first_sentence`,
      { timeout: 8000 }
    );
    const doc = res.data?.docs?.[0];
    if (!doc) return {};

    const coverUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : null;

    const synopsis = doc.first_sentence
      ? (typeof doc.first_sentence === 'object' ? doc.first_sentence.value : doc.first_sentence)
      : null;

    return { coverUrl, synopsis };
  } catch {
    return {};
  }
}

// ─── Caching Notion Databases ────────────────────────────────────────────────
async function fetchAllPages(databaseId) {
  let results = [];
  let cursor;
  let hasMore = true;
  while (hasMore) {
    const res = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    results = results.concat(res.results);
    hasMore = res.has_more;
    cursor = res.next_cursor;
    await sleep(350); // stay safe within rate limit
  }
  return results;
}

// ─── Main Execution ───────────────────────────────────────────────────────────
async function run() {
  console.log('====================================================');
  console.log('📚 Starting Unified Books Library Import & Linker...');
  if (isDryRun) {
    console.log('🧪 RUNNING IN DRY-RUN MODE (No modifications to Notion)');
  }
  console.log('====================================================\n');

  // 1. Fetch Goodreads CSV
  console.log('📥 Downloading Goodreads 10k dataset from GitHub...');
  let lines = [];
  let headers = [];
  try {
    const csvRes = await axios.get('https://raw.githubusercontent.com/zygmuntz/goodbooks-10k/master/books.csv');
    lines = csvRes.data.split('\n');
    headers = parseCSVLine(lines[0]);
    console.log(`   Downloaded successfully. Total raw lines: ${lines.length}`);
  } catch (err) {
    console.error('❌ Failed to fetch Goodreads CSV:', err.message);
    process.exit(1);
  }

  const authorIdx = headers.indexOf('authors');
  const titleIdx = headers.indexOf('title');
  const originalTitleIdx = headers.indexOf('original_title');
  const yearIdx = headers.indexOf('original_publication_year');
  const imageUrlIdx = headers.indexOf('image_url');

  // 2. Merge and de-duplicate
  console.log('\n🔄 Merging pre-curated classics with Goodreads popular books...');
  const finalBooks = [];
  const seenTitles = new Set();

  // Load pre-curated
  const preCurated = getPreCuratedBooks();
  console.log(`   Loaded ${preCurated.length} pre-curated books.`);
  for (const b of preCurated) {
    const key = b.title.trim().toLowerCase();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      finalBooks.push({
        title: b.title.trim(),
        author: b.author ? b.author.trim() : 'Unknown',
        year: b.year || null,
        pages: b.pages || null,
        type: b.type || 'Fiction',
        genre: b.genre || 'Fiction',
        coverUrl: null,
        isPreCurated: true
      });
    }
  }

  // Fill up to 2000 from Goodreads
  let addedCount = 0;
  for (let i = 1; i < lines.length; i++) {
    if (finalBooks.length >= 10000) break;
    const line = lines[i].trim();
    if (!line) continue;
    const row = parseCSVLine(line);
    if (row.length < headers.length) continue;

    let title = row[originalTitleIdx] ? row[originalTitleIdx].trim() : row[titleIdx].trim();
    if (!title) continue;

    // Strip series info
    title = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const key = title.toLowerCase();

    if (seenTitles.has(key)) continue;
    seenTitles.add(key);

    let author = row[authorIdx] ? row[authorIdx].split(',')[0].trim() : 'Unknown';
    author = author.replace(/^"+|"+$/g, '').trim();

    let year = null;
    const yearRaw = row[yearIdx];
    if (yearRaw) {
      year = parseInt(yearRaw.split('.')[0], 10);
    }

    let coverUrl = row[imageUrlIdx] ? row[imageUrlIdx].trim() : null;
    if (coverUrl) {
      // Convert Goodreads medium/small covers to high-resolution (large)
      coverUrl = coverUrl.replace(/\/books\/(\d+)[ms]\//, '/books/$1l/');
    }

    finalBooks.push({
      title,
      author,
      year,
      pages: null,
      type: 'Fiction',
      genre: 'Fiction',
      coverUrl,
      isPreCurated: false
    });
    addedCount++;
  }

  console.log(`   Added ${addedCount} additional books from Goodreads.`);
  console.log(`   🔥 Target dataset size: ${finalBooks.length} unique books.\n`);

  // 3. Query existing Notion databases to build caches
  console.log('🔍 Fetching existing Notion databases to build local maps (optimizes rate limits)...');
  
  console.log('   Fetching existing Books...');
  const existingBooksRaw = await fetchAllPages(BOOKS_DB_ID);
  const existingBooksMap = new Map();
  for (const page of existingBooksRaw) {
    let title = '';
    for (const prop of Object.values(page.properties)) {
      if (prop.type === 'title' && prop.title?.length > 0) {
        title = prop.title[0].plain_text.trim().toLowerCase();
        break;
      }
    }
    if (title) {
      const authorRel = page.properties.Author?.relation || [];
      const genreRel = page.properties.Genre?.relation || [];
      existingBooksMap.set(title, {
        id: page.id,
        authorLinked: authorRel.length > 0,
        genreLinked: genreRel.length > 0
      });
    }
  }
  console.log(`   ✔ Mapped ${existingBooksMap.size} existing books in Notion.`);

  console.log('   Fetching existing Authors...');
  const existingAuthorsRaw = await fetchAllPages(AUTHORS_DB_ID);
  const existingAuthorsMap = new Map();
  for (const page of existingAuthorsRaw) {
    let name = '';
    for (const prop of Object.values(page.properties)) {
      if (prop.type === 'title' && prop.title?.length > 0) {
        name = prop.title[0].plain_text.trim().toLowerCase();
        break;
      }
    }
    if (name) {
      existingAuthorsMap.set(name, page.id);
    }
  }
  console.log(`   ✔ Mapped ${existingAuthorsMap.size} existing authors in Notion.`);

  console.log('   Fetching existing Genres...');
  const existingGenresRaw = await fetchAllPages(GENRES_DB_ID);
  const existingGenresMap = new Map();
  for (const page of existingGenresRaw) {
    let name = '';
    for (const prop of Object.values(page.properties)) {
      if (prop.type === 'title' && prop.title?.length > 0) {
        name = prop.title[0].plain_text.trim().toLowerCase();
        break;
      }
    }
    if (name) {
      existingGenresMap.set(name, page.id);
    }
  }
  console.log(`   ✔ Mapped ${existingGenresMap.size} existing genres in Notion.\n`);

  if (isDryRun) {
    console.log('🧪 --- DRY-RUN SIMULATION (First 15 Books Mapping) ---');
    for (let i = 0; i < Math.min(15, finalBooks.length); i++) {
      const b = finalBooks[i];
      const hasAuthor = existingAuthorsMap.has(b.author.toLowerCase());
      const hasGenre = existingGenresMap.has(b.genre.toLowerCase());
      const hasBook = existingBooksMap.has(b.title.toLowerCase());
      
      console.log(`[Book ${i + 1}] "${b.title}"`);
      console.log(`   Author: "${b.author}" [${hasAuthor ? 'EXISTING' : 'NEW - WILL CREATE'}]`);
      console.log(`   Genre:  "${b.genre}" [${hasGenre ? 'EXISTING' : 'NEW - WILL CREATE'}]`);
      console.log(`   Status: [${hasBook ? 'ALREADY IN DB - WILL REPAIR RELATIONS IF EMPTY' : 'NEW - WILL IMPORT'}]`);
    }
    console.log('\nDry-run completed successfully! No changes were written to Notion.');
    return;
  }

  // 4. Processing Loop
  console.log('====================================================');
  console.log('🚀 Processing Books Database...');
  console.log('====================================================\n');

  let repairedCount = 0;
  let importedCount = 0;
  let skippedCount  = 0;
  let failedCount   = 0;

  for (let i = 0; i < finalBooks.length; i++) {
    const book = finalBooks[i];
    const key = book.title.toLowerCase();
    
    console.log(`[${i + 1}/${finalBooks.length}] Processing: "${book.title}"`);

    // A. Resolve Author relation
    const authorKey = book.author.toLowerCase();
    let authorId = existingAuthorsMap.get(authorKey);
    if (!authorId) {
      console.log(`   ✍  Creating new author in database: "${book.author}"...`);
      try {
        const page = await notion.pages.create({
          parent: { database_id: AUTHORS_DB_ID },
          properties: {
            Name: { title: [{ text: { content: book.author } }] }
          }
        });
        authorId = page.id;
        existingAuthorsMap.set(authorKey, authorId);
        await sleep(350);
      } catch (err) {
        console.error(`   ❌ Failed to create author "${book.author}":`, err.message);
      }
    }

    // B. Resolve Genre relation
    const genreKey = book.genre.toLowerCase();
    let genreId = existingGenresMap.get(genreKey);
    if (!genreId) {
      console.log(`   ✍  Creating new genre in database: "${book.genre}"...`);
      try {
        const page = await notion.pages.create({
          parent: { database_id: GENRES_DB_ID },
          properties: {
            Name: { title: [{ text: { content: book.genre } }] }
          }
        });
        genreId = page.id;
        existingGenresMap.set(genreKey, genreId);
        await sleep(350);
      } catch (err) {
        console.error(`   ❌ Failed to create genre "${book.genre}":`, err.message);
      }
    }

    // C. Check if Book already exists in Books database
    const existingBook = existingBooksMap.get(key);
    if (existingBook) {
      // Check if we need to repair empty relations
      if (!existingBook.authorLinked || !existingBook.genreLinked) {
        console.log(`   🛠  Repairing empty relations for existing book...`);
        const updateProperties = {};
        if (!existingBook.authorLinked && authorId) {
          updateProperties.Author = { relation: [{ id: authorId }] };
        }
        if (!existingBook.genreLinked && genreId) {
          updateProperties.Genre = { relation: [{ id: genreId }] };
        }

        let success = false;
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            await notion.pages.update({
              page_id: existingBook.id,
              properties: updateProperties
            });
            success = true;
            break;
          } catch (err) {
            if (err.code === 'rate_limited') {
              console.log(`   ⏳ Rate limited — waiting 60s (attempt ${attempt}/5)...`);
              await sleep(60000);
            } else {
              console.error(`   ❌ Error updating page: ${err.message}`);
              break;
            }
          }
        }
        if (success) {
          console.log(`   \x1b[32m✅ Repaired relations successfully!\x1b[0m`);
          repairedCount++;
        } else {
          failedCount++;
        }
        await sleep(350);
      } else {
        console.log(`   ⚪ Skipping (already exists with relations linked)`);
        skippedCount++;
      }
      continue;
    }

    // D. Import new book
    console.log(`   📥 Importing new book...`);
    let coverUrl = book.coverUrl;
    let synopsis = null;

    // For pre-curated books, fetch Open Library details on the fly
    if (book.isPreCurated) {
      const meta = await fetchBookMeta(book.title, book.author);
      if (meta.coverUrl) coverUrl = meta.coverUrl;
      if (meta.synopsis) synopsis = meta.synopsis;
    }

    // Fallback to Open Library if Goodreads has no cover URL
    if (!coverUrl) {
      const meta = await fetchBookMeta(book.title, book.author);
      if (meta.coverUrl) coverUrl = meta.coverUrl;
    }

    const properties = {
      Title:   { title: [{ text: { content: book.title } }] },
      Status:  { select: { name: 'Want to Read' } },
      Type:    { select: { name: book.type } },
      'Total Pages ': book.pages ? { number: book.pages } : { number: null },
    };

    if (authorId) {
      properties.Author = { relation: [{ id: authorId }] };
    }
    if (genreId) {
      properties.Genre = { relation: [{ id: genreId }] };
    }

    const cover = coverUrl ? { external: { url: coverUrl } } : null;

    const pagePayload = {
      parent: { database_id: BOOKS_DB_ID },
      properties,
      cover: cover || undefined
    };

    const children = [];
    if (synopsis) {
      children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: synopsis.slice(0, 2000) } }]
        }
      });
    }
    if (children.length > 0) pagePayload.children = children;

    let success = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await notion.pages.create(pagePayload);
        success = true;
        break;
      } catch (err) {
        if (err.code === 'rate_limited') {
          console.log(`   ⏳ Rate limited — waiting 60s (attempt ${attempt}/5)...`);
          await sleep(60000);
        } else {
          console.error(`   ❌ Error creating page: ${err.message}`);
          break;
        }
      }
    }

    if (success) {
      console.log(`   \x1b[32m✅ Successfully Imported!\x1b[0m`);
      importedCount++;
    } else {
      failedCount++;
    }

    await sleep(350);
  }

  console.log('\n====================================================');
  console.log('🎉 Books Import & Linking Complete!');
  console.log(`✅ Newly Imported: ${importedCount}`);
  console.log(`🛠  Relations Repaired: ${repairedCount}`);
  console.log(`⚪ Already Correct:  ${skippedCount}`);
  console.log(`❌ Failed:          ${failedCount}`);
  console.log(`📚 Total Books in Set: ${finalBooks.length}`);
  console.log('====================================================\n');
}

run();
