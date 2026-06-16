const axios = require('axios');

async function test() {
  try {
    const url = 'https://raw.githubusercontent.com/zygmuntz/goodbooks-10k/master/books.csv';
    console.log('Fetching first 2000 bytes of CSV...');
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
