const axios = require('axios');

async function test() {
  try {
    console.log('Searching Jikan v4 for "Frieren"...');
    const res = await axios.get('https://api.jikan.moe/v4/anime', { params: { q: 'Frieren', limit: 3 } });
    console.log('SUCCESS! Found results:');
    res.data.data.forEach(anime => {
      console.log(`- [${anime.mal_id}] ${anime.title} (Score: ${anime.score})`);
    });
  } catch (e) {
    console.error('ERROR searching:', e.message);
  }
}

test();
