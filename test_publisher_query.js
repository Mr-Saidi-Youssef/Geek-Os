const axios = require('axios');

async function testPublisherQuery() {
  const url = 'https://openlibrary.org/search.json';
  try {
    const res = await axios.get(url, {
      params: {
        q: '(subject:graphic_novels OR subject:comic_books) AND publisher:("DC Comics" OR "Marvel" OR "Image Comics" OR "Dark Horse" OR "Vertigo" OR "IDW") AND NOT subject:manga AND NOT subject:japan AND NOT subject:japanese',
        limit: 20
      }
    });
    console.log('Results count:', res.data?.numFound);
    console.log('Sample Results:');
    for (const doc of res.data?.docs || []) {
      const rating = doc.ratings_average ? doc.ratings_average.toFixed(2) : 'N/A';
      const cover = doc.cover_i ? 'Yes' : 'No';
      console.log(`- "${doc.title}" by ${doc.author_name?.join(', ')} | Publisher: ${doc.publisher?.[0]} | Rating: ${rating} | Cover: ${cover}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testPublisherQuery();
