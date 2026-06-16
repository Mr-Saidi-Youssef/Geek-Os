const axios = require('axios');

async function test() {
  try {
    const url = 'https://raw.githubusercontent.com/vamshi121/TMDB-5000-Movie-Dataset/main/tmdb_5000_movies.csv';
    console.log('Fetching first 2000 bytes of TMDB 5000 movies CSV...');
    const res = await axios.get(url, {
      headers: { 'Range': 'bytes=0-2000' }
    });
    console.log('=== CSV Snippet ===');
    console.log(res.data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
