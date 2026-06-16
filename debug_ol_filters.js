const axios = require('axios');

async function debugOpenLibrarySearch() {
  const searchUrl = 'https://openlibrary.org/search.json';
  
  console.log('Querying Open Library with the exact search parameters from seeder...');
  try {
    const response = await axios.get(searchUrl, {
      params: {
        q: '(subject:graphic_novels OR subject:comic_books) AND publisher:("DC Comics" OR "Marvel" OR "Image" OR "Dark Horse" OR "Vertigo" OR "IDW") AND NOT subject:manga AND NOT subject:japan AND NOT subject:japanese',
        limit: 50,
        page: 1
      }
    });

    console.log(`Total found: ${response.data.numFound}`);
    const docs = response.data.docs || [];
    console.log(`Docs returned: ${docs.length}`);

    if (docs.length === 0) {
      console.log('Zero docs returned! Testing a simpler, highly effective query...');
      
      const simplerQueries = [
        'subject:graphic_novels AND publisher:("DC Comics" OR "Marvel" OR "Image" OR "Dark Horse")',
        'subject:comic_books AND publisher:("DC Comics" OR "Marvel")',
        'subject:graphic_novels AND NOT subject:manga',
        'subject:comic_books AND NOT subject:manga'
      ];

      for (const sq of simplerQueries) {
        const sqRes = await axios.get(searchUrl, { params: { q: sq, limit: 10 } });
        console.log(`- Simpler Query "${sq}" -> Total found: ${sqRes.data.numFound}`);
      }
      return;
    }

    let stats = {
      total: docs.length,
      hasCover: 0,
      hasAuthor: 0,
      hasRating: 0,
      notManga: 0,
      notTrash: 0,
      passedAll: 0
    };

    const mangaKeywords = ['manga', 'japan', 'japanese', 'shonen', 'shojo', 'seinen', 'josei'];
    const trashKeywords = ['diary of', 'wimpy kid', 'dork diaries', 'big nate'];

    for (const doc of docs) {
      if (doc.cover_i) stats.hasCover++;
      if (doc.author_name && doc.author_name.length > 0) stats.hasAuthor++;
      if (doc.ratings_average) stats.hasRating++;

      const titleLower = (doc.title || '').toLowerCase();
      const isManga = mangaKeywords.some(kw => titleLower.includes(kw)) || 
                      doc.subject?.some(s => mangaKeywords.some(kw => s.toLowerCase().includes(kw)));
      if (!isManga) stats.notManga++;

      const isTrash = trashKeywords.some(kw => titleLower.includes(kw));
      if (!isTrash) stats.notTrash++;

      if (doc.cover_i && doc.author_name && doc.author_name.length > 0 && doc.ratings_average && !isManga && !isTrash) {
        stats.passedAll++;
        console.log(`Passed: "${doc.title}" by ${doc.author_name[0]} | Rating: ${doc.ratings_average} | Cover: ${doc.cover_i}`);
      }
    }

    console.log('\nFilter Stats:', stats);

  } catch (error) {
    console.error('Error debugging:', error.message);
  }
}

debugOpenLibrarySearch();
