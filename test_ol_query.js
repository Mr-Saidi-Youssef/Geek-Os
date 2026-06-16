const axios = require('axios');

async function testQuery() {
  const url = 'https://openlibrary.org/search.json';
  try {
    const res = await axios.get(url, {
      params: {
        q: '(subject:graphic_novels OR subject:comic_books) AND NOT subject:manga AND NOT subject:japan AND NOT subject:japanese',
        limit: 10
      }
    });
    console.log('Results count:', res.data?.numFound);
    console.log('Sample Results:');
    for (const doc of res.data?.docs || []) {
      console.log(`- "${doc.title}" by ${doc.author_name?.join(', ')} | Subjects: ${doc.subject?.slice(0, 3).join(', ')}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testQuery();
