const axios = require('axios');

const urls = {
  "Taylor Swift": "https://m.media-amazon.com/images/M/MV5BYjRiZDI3ZmYtZTk0Ni00MzEwLWIwMWEtMTgwY2VmM2IwNjk2XkEyXkFqcGdeQXVyMTEzNjM5MDg1._V1_SX300.jpg",
  "Kill Bill": "https://m.media-amazon.com/images/M/MV5BZDc2YzhkODAtZmRmZS00YzcxLWJkYWEtM2ZhZjY3MmMyZmJiXkEyXkFqcGc@.jpg",
  "Goodfellas": "https://m.media-amazon.com/images/M/MV5BY2NkZjEzMDgtN2RjYy00YzM1LWI4ZmQtMjIwYjFjNmI3ZGEwXkEyXkFqcGdeQXVyNzkwMjQ5NzM@.jpg"
};

async function test() {
  for (const [name, url] of Object.entries(urls)) {
    try {
      const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`${name}: HTTP ${res.status}, Content-Type: ${res.headers['content-type']}, Content-Length: ${res.headers['content-length']}`);
    } catch (err) {
      console.log(`${name}: Failed - HTTP ${err.response?.status || 'Unknown'}, Message: ${err.message}`);
    }
  }
}

test();
