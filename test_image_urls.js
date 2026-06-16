const axios = require('axios');

const urls = {
  'Fresh Tracks': 'https://m.media-amazon.com/images/M/MV5BZjgyNmE4MWItYzYzMC00ODAyLWEwNTctMGE2ZmY1MjZlOWNjXkEyXkFqcGdeQXVyNTM3MDMyMDQ@._V1_FMjpg_UY750_.jpg',
  'Nature\'s Power Revealed': 'https://m.media-amazon.com/images/M/MV5BZTgwNTc5NDQtMjBmNy00NTYzLTkxN2ItZGQ3NmI2ZDlhODBhL2ltYWdlL2ltYWdlXkEyXkFqcGdeQXVyNTIxMTExNw@@._V1_FMjpg_UY750_.jpg',
  'Green Paradise': 'https://m.media-amazon.com/images/M/MV5BYTQ0ZGMxNDAtNDQ2My00YWQzLTkxYzYtOGU0NzE2MDgzY2RjXkEyXkFqcGdeQXVyMTIzNTI5NTM1._V1_SX300.jpg',
  'Harmony with A R Rahman': 'https://m.media-amazon.com/images/M/MV5BYjZmNGYwMGItNTJiNi00YWE2LWI3NDQtMzhiODJjZDI2ZjQwXkEyXkFqcGdeQXVyODk1MzE5NDA@._V1_FMjpg_UY750_.jpg',
  'Peasants Rebellion': 'https://m.media-amazon.com/images/M/MV5BYjc1ZjdjMDctZWQ5Yi00MjA0LTg1MGQtOTU2MmYyNzRkMWM0XkEyXkFqcGdeQXVyMjA4NzE5MTE@._V1_FMjpg_UY750_.jpg'
};

async function testUrls() {
  for (const [title, url] of Object.entries(urls)) {
    try {
      const response = await axios.head(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      console.log(`"${title}" - HEAD: ${response.status} (OK)`);
    } catch (err) {
      console.log(`"${title}" - HEAD failed: ${err.message}`);
      // Try GET in case HEAD is blocked
      try {
        const getRes = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 4000
        });
        console.log(`  GET: ${getRes.status} (OK)`);
      } catch (getErr) {
        console.log(`  GET failed: ${getErr.message}`);
      }
    }
  }
}

testUrls();
