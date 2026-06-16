const axios = require('axios');

async function test() {
  try {
    const url = 'https://raw.githubusercontent.com/yinghaoz1/tmdb-movie-dataset-analysis/master/tmdb_movies.csv';
    console.log('Fetching first 2000 bytes of TMDB movies CSV...');
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
