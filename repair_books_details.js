/**
 * repair_books_details.js
 * Automatically sweeps the Notion Books database to:
 * 1. Ensure "Synopsis" (rich_text) and "Community Rating" (number) database properties exist.
 * 2. Upgrade missing covers and Goodreads grey placeholders to HD covers (page cover + Cover files property).
 * 3. Recover missing page counts.
 * 4. Fetch rich descriptions ("What the book is about") from Open Library.
 * 5. Resolve community ratings from Goodreads CSV or Open Library ratings API.
 * 6. Classify book Types correctly to "Non-Fiction" or "Fiction" using OL subjects.
 * 7. Link books to their actual registered Genre page relations in place.
 * Powered by Open Library API & Official Notion Client
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const BOOKS_DB_ID  = '8b2780bfd84442d8bcd95223152c0ece';
const GENRES_DB_ID  = '37d28afc-7789-44af-8035-2bb161318e31';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep  = (ms) => new Promise((r) => setTimeout(r, ms));

// Map Open Library subject keywords to standardized Byronotion Genre database names
const SUBJECT_TO_GENRE_NAME = {
  'biography': 'Biography',
  'autobiography': 'Biography',
  'memoir': 'Memoir',
  'memoirs': 'Memoir',
  'business': 'Business',
  'leadership': 'Business',
  'economics': 'Economics',
  'finance': 'Economics',
  'self-help': 'Self-Help',
  'success': 'Self-Help',
  'psychology': 'Psychology',
  'history': 'History',
  'historical': 'History',
  'science': 'Science',
  'physics': 'Science',
  'chemistry': 'Science',
  'biology': 'Science',
  'philosophy': 'Philosophy',
  'philosophical': 'Philosophical',
  'religion': 'Religion',
  'spirituality': 'Spirituality',
  'spiritual': 'Spirituality',
  'fantasy': 'Fantasy',
  'science fiction': 'Science Fiction',
  'sci-fi': 'Sci-Fi',
  'thriller': 'Thriller',
  'suspense': 'Thriller',
  'mystery': 'Mystery',
  'detective': 'Mystery',
  'romance': 'Romance',
  'love': 'Romance',
  'horror': 'Horror',
  'scary': 'Horror',
  'dystopian': 'Dystopian',
  'dystopia': 'Dystopian',
  'young adult': 'Young Adult',
  'ya': 'Young Adult',
  'children': "Children's",
  'kids': "Children's",
  'war': 'War',
  'adventure': 'Adventure',
  'drama': 'Drama',
  'graphic novel': 'Graphic Novel',
  'comics': 'Graphic Novel',
  'social commentary': 'Social Commentary',
  'sociology': 'Social Commentary',
  'politics': 'Social Commentary',
  'essay': 'Essays',
  'essays': 'Essays'
};

const NON_FICTION_KEYWORDS = [
  'nonfiction', 'non-fiction', 'business', 'biography', 'history', 'science',
  'psychology', 'self-help', 'leadership', 'economics', 'politics', 'memoir',
  'autobiography', 'philosophy', 'success', 'essays', 'religion', 'spirituality',
  'sociology', 'anthropology', 'parenting', 'finance', 'investing', 'memoirs',
  'historical', 'government', 'management', 'law', 'education'
];

// Robust CSV Line Parser
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
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

// Download and build offline ratings map from Goodreads CSV
async function loadGoodreadsRatingsMap() {
  const grMap = new Map();
  console.log('📥 Downloading Goodreads CSV to build offline ratings map...');
  try {
    const csvRes = await axios.get('https://raw.githubusercontent.com/zygmuntz/goodbooks-10k/master/books.csv', { timeout: 15000 });
    const lines = csvRes.data.split('\n');
    const headers = parseCSVLine(lines[0]);
    const titleIdx = headers.indexOf('original_title') !== -1 ? headers.indexOf('original_title') : headers.indexOf('title');
    const ratingIdx = headers.indexOf('average_rating');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const row = parseCSVLine(line);
      if (row.length < Math.max(titleIdx, ratingIdx)) continue;
      let title = row[titleIdx]?.replace(/^"+|"+$/g, '').trim().toLowerCase();
      const rating = parseFloat(row[ratingIdx]);
      if (title && !isNaN(rating)) {
        title = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
        grMap.set(title, rating);
      }
    }
    console.log(`   ✔ Loaded ${grMap.size} ratings from Goodreads CSV.\n`);
  } catch (err) {
    console.warn(`   ⚠️  Failed to fetch Goodreads CSV ratings (${err.message}). Falling back to live API ratings.`);
  }
  return grMap;
}

// Strict title relevance matching validator
function titleMatches(targetTitle, returnedTitle) {
  const targetWords = targetTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const returnedClean = returnedTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  if (targetWords.length === 0) return true;
  let matched = 0;
  for (const word of targetWords) {
    if (returnedClean.includes(word)) matched++;
  }
  return (matched / targetWords.length) >= 0.6;
}

// Highly precise phased search on Open Library
async function fetchOpenLibrary(title, author) {
  const cleanTitle = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
  
  // Phase 1: Strict field search (title + author)
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&author=${encodeURIComponent(author || '')}&limit=10&fields=key,title,cover_i,number_of_pages_median,subject,author_name`;
    const res = await axios.get(url, { timeout: 8000 });
    const docs = res.data?.docs || [];
    
    // Pick first match that has a cover
    for (const doc of docs) {
      if (titleMatches(cleanTitle, doc.title) && doc.cover_i) {
        return doc;
      }
    }
    // Fallback to first match overall
    for (const doc of docs) {
      if (titleMatches(cleanTitle, doc.title)) {
        return doc;
      }
    }
  } catch (err) {
    // silently continue to next phase
  }

  // Phase 2: Exact Title search + loose author filter
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&limit=10&fields=key,title,cover_i,number_of_pages_median,subject,author_name`;
    const res = await axios.get(url, { timeout: 8000 });
    const docs = res.data?.docs || [];
    
    // First try: match title and author word check + must have cover
    for (const doc of docs) {
      if (titleMatches(cleanTitle, doc.title) && doc.cover_i) {
        const authorMatch = author && doc.author_name?.some(name => 
          author.toLowerCase().split(/\s+/).some(word => word.length > 3 && name.toLowerCase().includes(word))
        );
        if (authorMatch || !author) return doc;
      }
    }
    // Second try: match title + must have cover
    for (const doc of docs) {
      if (titleMatches(cleanTitle, doc.title) && doc.cover_i) {
        return doc;
      }
    }
    // Third try: match title overall
    for (const doc of docs) {
      if (titleMatches(cleanTitle, doc.title)) {
        return doc;
      }
    }
  } catch (err) {
    // silently continue to next phase
  }

  // Phase 3: Loose text query with strict title-matching verification
  try {
    const query = encodeURIComponent(`${cleanTitle} ${author || ''}`);
    const url = `https://openlibrary.org/search.json?q=${query}&limit=5&fields=key,title,cover_i,number_of_pages_median,subject,author_name`;
    const res = await axios.get(url, { timeout: 8000 });
    const docs = res.data?.docs || [];
    for (const doc of docs) {
      if (titleMatches(cleanTitle, doc.title)) {
        return doc;
      }
    }
  } catch (err) {
    // silently fail
  }

  return null;
}

// Fetch all pages from a database
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
    await sleep(350);
  }
  return results;
}

// Start main sweep process
async function run() {
  console.log('====================================================');
  console.log('🛠️  Starting Books Details, Ratings & Synopsis Repair Sweep...');
  console.log('====================================================\n');

  try {
    // 1. Ensure "Synopsis" (rich_text) and "Community Rating" (number) database properties exist
    console.log('🛠️  Ensuring database schema has "Synopsis" and "Community Rating" properties...');
    try {
      await notion.databases.update({
        database_id: BOOKS_DB_ID,
        properties: {
          'Synopsis': {
            rich_text: {}
          },
          'Community Rating': {
            number: {
              format: 'number'
            }
          }
        }
      });
      console.log('   ✔ Database properties verified/created successfully.\n');
    } catch (e) {
      console.error('   ❌ Failed to update database schema:', e.message);
    }

    // 2. Preload Goodreads Offline ratings map
    const grRatingsMap = await loadGoodreadsRatingsMap();

    // 3. Fetch all Genres to resolve IDs dynamically
    console.log('🔍 Fetching all Genres from Notion Genres database...');
    const genresRaw = await fetchAllPages(GENRES_DB_ID);
    const notionGenresMap = new Map();
    for (const page of genresRaw) {
      let name = '';
      for (const prop of Object.values(page.properties)) {
        if (prop.type === 'title' && prop.title?.length > 0) {
          name = prop.title[0].plain_text.trim();
          break;
        }
      }
      if (name) {
        notionGenresMap.set(name.toLowerCase(), page.id);
      }
    }
    console.log(`   ✔ Mapped ${notionGenresMap.size} genres from Notion.`);

    // Local Genres Database Creator Helper
    async function resolveGenreId(genreName) {
      const key = genreName.toLowerCase();
      if (notionGenresMap.has(key)) {
        return notionGenresMap.get(key);
      }
      console.log(`   ✍  Creating new genre in database: "${genreName}"...`);
      try {
        const page = await notion.pages.create({
          parent: { database_id: GENRES_DB_ID },
          properties: {
            Name: { title: [{ text: { content: genreName } }] }
          }
        });
        notionGenresMap.set(key, page.id);
        await sleep(350);
        return page.id;
      } catch (err) {
        console.error(`   ❌ Failed to create genre "${genreName}":`, err.message);
        return null;
      }
    }

    const fictionId = await resolveGenreId('Fiction');
    const nonFictionId = await resolveGenreId('Non-Fiction');

    // Dynamic Author Name cache resolver
    const authorIdMap = new Map();
    async function resolveAuthorName(authorId) {
      if (!authorId) return '';
      if (authorIdMap.has(authorId)) {
        return authorIdMap.get(authorId);
      }
      try {
        const page = await notion.pages.retrieve({ page_id: authorId });
        let name = '';
        for (const prop of Object.values(page.properties)) {
          if (prop.type === 'title' && prop.title?.length > 0) {
            name = prop.title[0].plain_text.trim();
            break;
          }
        }
        if (name) {
          authorIdMap.set(authorId, name);
          return name;
        }
      } catch (err) {
        console.error(`   ❌ Failed to retrieve author name for page ${authorId}:`, err.message);
      }
      return '';
    }

    // 4. Scan Books Database page-by-page
    console.log('\n🔍 Scanning Books database in Notion...');
    let hasMore = true;
    let cursor = undefined;
    let processedCount = 0;
    let repairedCovers = 0;
    let repairedPages = 0;
    let repairedType = 0;
    let repairedGenre = 0;
    let repairedRatings = 0;
    let repairedSynopses = 0;

    const forceCoversFlag = process.argv.includes('--force-covers');

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: BOOKS_DB_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        processedCount++;
        
        let title = '';
        for (const prop of Object.values(page.properties)) {
          if (prop.type === 'title' && prop.title?.length > 0) {
            title = prop.title[0].plain_text.trim();
            break;
          }
        }

        if (!title) continue;

        // Read current properties
        const pagesProp = page.properties['Total Pages ']?.number;
        const typeProp = page.properties.Type?.select?.name || '';
        const genreRel = page.properties.Genre?.relation || [];
        const synopsisProp = page.properties.Synopsis?.rich_text || [];
        const ratingProp = page.properties['Community Rating']?.number;

        const currentCoverUrl = page.cover?.external?.url || page.cover?.file?.url || '';

        // Check page cover placeholders
        let isPageCoverPlaceholder = false;
        if (!page.cover) {
          isPageCoverPlaceholder = true;
        } else if (page.cover.type === 'external' && page.cover.external.url) {
          const url = page.cover.external.url;
          if (url.includes('nophoto') || url.includes('book-placeholder') || url.includes('g-book-placeholder') || url.includes('111x148') || url.includes('nocover')) {
            isPageCoverPlaceholder = true;
          }
        } else if (page.cover.type === 'file' && page.cover.file.url) {
          const url = page.cover.file.url;
          if (url.includes('nophoto') || url.includes('book-placeholder') || url.includes('g-book-placeholder') || url.includes('111x148') || url.includes('nocover')) {
            isPageCoverPlaceholder = true;
          }
        }

        // Check Cover property placeholders
        const coverProp = page.properties.Cover?.files || [];
        let isCoverPropPlaceholder = coverProp.length === 0;
        if (coverProp.length > 0) {
          const url = coverProp[0]?.external?.url || coverProp[0]?.file?.url || '';
          if (url.includes('nophoto') || url.includes('book-placeholder') || url.includes('g-book-placeholder') || url.includes('111x148') || url.includes('nocover')) {
            isCoverPropPlaceholder = true;
          }
        }

        let needsCover = isPageCoverPlaceholder || isCoverPropPlaceholder;
        
        // Dynamic Force cover upgrade logic (overwrites any incorrect Open Library covers)
        if (forceCoversFlag && currentCoverUrl.includes('openlibrary.org')) {
          needsCover = true;
        }

        const needsPages = pagesProp === null || pagesProp === 0 || pagesProp === undefined;
        const needsSynopsis = synopsisProp.length === 0;
        const needsRating = ratingProp === null || ratingProp === undefined;
        
        // A book has generic genre if it's empty, or only linked to "Fiction" or "Non-Fiction" generic pages
        const isGenericGenre = genreRel.length === 0 || 
          genreRel.every(rel => rel.id === fictionId || rel.id === nonFictionId);

        // We check Open Library if it needs cover, page count, synopsis, rating, or needs genre/type classification repair
        if (needsCover || needsPages || isGenericGenre || needsSynopsis || needsRating) {
          // Resolve Author Name dynamically on demand
          const authorRel = page.properties.Author?.relation || [];
          const authorName = authorRel.length > 0 ? await resolveAuthorName(authorRel[0].id) : '';

          console.log(`\n[#${processedCount}] Auditing Book: "${title}" by "${authorName || 'Unknown'}"`);
          
          const meta = await fetchOpenLibrary(title, authorName);
          if (!meta) {
            console.log(`   ⚠️ Open Library yielded no search results. Skipping.`);
            continue;
          }

          const updateProperties = {};
          let newCover = null;

          // A. Repair Cover Poster (both page cover and files property column)
          if (needsCover && meta.cover_i) {
            const coverUrl = `https://covers.openlibrary.org/b/id/${meta.cover_i}-L.jpg`;
            
            if (currentCoverUrl !== coverUrl) {
              // Set built-in page cover
              newCover = {
                type: 'external',
                external: { url: coverUrl }
              };

              // Set database property files cover
              updateProperties.Cover = {
                files: [
                  {
                    name: 'Cover Image',
                    type: 'external',
                    external: { url: coverUrl }
                  }
                ]
              };

              console.log(`   🖼️  Found High-Res Cover Poster: ${coverUrl}`);
              repairedCovers++;
            } else {
              console.log(`   ⚪ Cover is already up-to-date: ${coverUrl}`);
            }
          }

          // B. Repair Page Numbers
          if (needsPages && meta.number_of_pages_median) {
            updateProperties['Total Pages '] = { number: meta.number_of_pages_median };
            console.log(`   📖 Found median page count: ${meta.number_of_pages_median} pages`);
            repairedPages++;
          }

          // C. Fetch & Repair Community Rating
          if (needsRating) {
            let ratingVal = null;
            const titleKey = title.toLowerCase().replace(/\s*\([^)]*\)\s*$/, '').trim();
            
            // Check offline Goodreads CSV map first
            if (grRatingsMap.has(titleKey)) {
              ratingVal = grRatingsMap.get(titleKey);
              console.log(`   ⭐ Found Goodreads Offline rating: ${ratingVal}`);
            } else if (meta.key) {
              // Fallback to live Open Library ratings API
              try {
                const ratingsUrl = `https://openlibrary.org${meta.key}/ratings.json`;
                const ratingsRes = await axios.get(ratingsUrl, { timeout: 5000 });
                const avg = ratingsRes.data?.summary?.average;
                if (avg) {
                  ratingVal = parseFloat(avg.toFixed(2));
                  console.log(`   ⭐ Found Open Library Live rating: ${ratingVal}`);
                }
              } catch (err) {
                console.warn(`   ⚠️ Live rating fetch failed: ${err.message}`);
              }
            }

            if (ratingVal) {
              updateProperties['Community Rating'] = { number: ratingVal };
              repairedRatings++;
            }
          }

          // D. Fetch & Repair Synopsis ("What the book is about")
          if (needsSynopsis && meta.key) {
            try {
              const workUrl = `https://openlibrary.org${meta.key}.json`;
              const workRes = await axios.get(workUrl, { timeout: 6000 });
              const desc = workRes.data?.description;
              let descriptionText = '';
              if (desc) {
                descriptionText = typeof desc === 'object' ? desc.value : desc;
              }

              if (descriptionText) {
                const cleanDesc = descriptionText.replace(/[#*`_[\]]/g, '').slice(0, 2000).trim();
                updateProperties.Synopsis = {
                  rich_text: [{ type: 'text', text: { content: cleanDesc } }]
                };
                console.log(`   📝 Found description snippet: "${cleanDesc.slice(0, 80)}..."`);
                repairedSynopses++;
              }
            } catch (err) {
              console.warn(`   ⚠️ Live description fetch failed: ${err.message}`);
            }
          }

          // E. Re-classify Type & Genre relation
          if (meta.subject && Array.isArray(meta.subject)) {
            const subjects = meta.subject.map(s => s.toLowerCase());

            // Check for Non-Fiction indicators
            let isNonFiction = false;
            for (const sub of subjects) {
              if (NON_FICTION_KEYWORDS.some(kw => sub.includes(kw))) {
                isNonFiction = true;
                break;
              }
            }

            // Map Type select value
            const newType = isNonFiction ? 'Non-Fiction' : 'Fiction';
            if (typeProp !== newType) {
              updateProperties.Type = { select: { name: newType } };
              console.log(`   🏷️  Classified Type correctly: "${newType}" (was "${typeProp || 'none'}")`);
              repairedType++;
            }

            // Map and link Genre relations
            if (isGenericGenre) {
              const matchedGenreIds = [];
              for (const sub of subjects) {
                for (const [key, normalizedGenreName] of Object.entries(SUBJECT_TO_GENRE_NAME)) {
                  if (sub.includes(key)) {
                    const pageId = await resolveGenreId(normalizedGenreName);
                    if (pageId && !matchedGenreIds.includes(pageId)) {
                      matchedGenreIds.push(pageId);
                    }
                  }
                }
              }

              // Fallback to general type if no specific subjects matched
              if (matchedGenreIds.length === 0) {
                const fallbackGenre = isNonFiction ? 'Non-Fiction' : 'Fiction';
                const pageId = await resolveGenreId(fallbackGenre);
                if (pageId) matchedGenreIds.push(pageId);
              }

              if (matchedGenreIds.length > 0) {
                updateProperties.Genre = {
                  relation: matchedGenreIds.map(id => ({ id }))
                };
                console.log(`   🔗 Mapped Genres: ${matchedGenreIds.length} categories`);
                repairedGenre++;
              }
            }
          } else {
            // Fallback if subjects are not returned
            if (typeProp === '') {
              updateProperties.Type = { select: { name: 'Fiction' } };
              repairedType++;
            }
            if (isGenericGenre && fictionId) {
              updateProperties.Genre = {
                relation: [{ id: fictionId }]
              };
              repairedGenre++;
            }
          }

          // Commit Updates to Notion
          if (Object.keys(updateProperties).length > 0 || newCover) {
            try {
              const payload = { page_id: page.id };
              if (Object.keys(updateProperties).length > 0) payload.properties = updateProperties;
              if (newCover) payload.cover = newCover;

              await notion.pages.update(payload);
              console.log(`   \x1b[32m✅ Successfully Updated Book Card!\x1b[0m`);
            } catch (err) {
              console.error(`   ❌ Failed to update page:`, err.message);
            }
            await sleep(350); // safe limit throttling
          }
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor;
    }

    console.log('\n====================================================');
    console.log('🎉 Books Metadata, Ratings & Synopsis Sweep Complete!');
    console.log(`🟢 Successfully Repaired Covers:  ${repairedCovers}`);
    console.log(`🟢 Successfully Repaired Pages:   ${repairedPages}`);
    console.log(`🟢 Successfully Repaired Ratings: ${repairedRatings}`);
    console.log(`🟢 Successfully Repaired Synopses: ${repairedSynopses}`);
    console.log(`🟢 Successfully Repaired Type:    ${repairedType}`);
    console.log(`🟢 Successfully Repaired Genres:  ${repairedGenre}`);
    console.log(`⚪ Total Cards Scanned:           ${processedCount}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error during repair process:', error.message);
  }
}

run();
