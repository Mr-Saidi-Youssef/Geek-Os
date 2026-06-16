const axios = require('axios');

async function checkUrl(url) {
  try {
    const res = await axios.head(url);
    console.log(`URL: ${url}`);
    console.log(`  Status: ${res.status}`);
    console.log(`  Content-Length: ${res.headers['content-length']}`);
  } catch (e) {
    console.log(`URL: ${url} -> FAILED: ${e.message}`);
  }
}

async function run() {
  const medium = 'https://images.gr-assets.com/books/1447303603m/2767052.jpg';
  // Use regex to replace only the m/ in the books folder
  const large = medium.replace(/\/books\/(\d+)m\//, '/books/$1l/');
  
  console.log('Checking medium URL...');
  await checkUrl(medium);
  console.log('Checking large URL...');
  await checkUrl(large);
}

run();
