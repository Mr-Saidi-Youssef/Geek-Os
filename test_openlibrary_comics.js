const axios = require('axios');

async function testOpenLibrary() {
  const url = 'https://openlibrary.org/search.json';
  try {
    console.log('Querying Open Library for subject:comic_books OR subject:graphic_novels...');
    const response = await axios.get(url, {
      params: {
        q: 'subject:graphic_novels OR subject:comic_books',
        limit: 10,
      }
    });

    console.log(`Total found: ${response.data.numFound}`);
    const docs = response.data.docs;
    console.log('Sample docs returned:', docs.length);
    if (docs.length > 0) {
      const doc = docs[0];
      console.log('\nKeys in first doc:', Object.keys(doc));
      console.log('\nRatings / Score attributes found:');
      for (const [k, v] of Object.entries(doc)) {
        if (k.toLowerCase().includes('rate') || k.toLowerCase().includes('score') || k.toLowerCase().includes('star')) {
          console.log(`- ${k}:`, v);
        }
      }
      console.log('\nSample doc details:');
      console.log(JSON.stringify({
        title: doc.title,
        author_name: doc.author_name,
        ratings_average: doc.ratings_average,
        ratings_count: doc.ratings_count,
        ratings_sortable: doc.ratings_sortable
      }, null, 2));
    }
  } catch (error) {
    console.error('Error querying Open Library:', error.message);
  }
}

testOpenLibrary();
