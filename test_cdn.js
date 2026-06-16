const axios = require('axios');

const urls = {
  "Goodfellas Raw": "https://m.media-amazon.com/images/M/MV5BY2NkZjEzMDgtN2RjYy00YzM1LWI4ZmQtMjIwYjFjNmI3ZGEwXkEyXkFqcGdeQXVyNzkwMjQ5NzM@.jpg",
  "Goodfellas UX500": "https://m.media-amazon.com/images/M/MV5BY2NkZjEzMDgtN2RjYy00YzM1LWI4ZmQtMjIwYjFjNmI3ZGEwXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_FMjpg_UX500_.jpg",
  "Goodfellas UY750": "https://m.media-amazon.com/images/M/MV5BY2NkZjEzMDgtN2RjYy00YzM1LWI4ZmQtMjIwYjFjNmI3ZGEwXkEyXkFqcGdeQXVyNzkwMjQ5NzM@._V1_FMjpg_UY750_.jpg",
  "Kill Bill Raw": "https://m.media-amazon.com/images/M/MV5BZDc2YzhkODAtZmRmZS00YzcxLWJkYWEtM2ZhZjY3MmMyZmJiXkEyXkFqcGc@.jpg",
  "Kill Bill UX500": "https://m.media-amazon.com/images/M/MV5BZDc2YzhkODAtZmRmZS00YzcxLWJkYWEtM2ZhZjY3MmMyZmJiXkEyXkFqcGc@._V1_FMjpg_UX500_.jpg"
};

async function test() {
  for (const [name, url] of Object.entries(urls)) {
    try {
      const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`${name}: HTTP ${res.status}, Content-Type: ${res.headers['content-type']}, Size: ${res.headers['content-length']}`);
    } catch (err) {
      console.log(`${name}: Failed - HTTP ${err.response?.status || 'Unknown'}, Message: ${err.message}`);
    }
  }
}

test();
