const axios = require('axios');

async function testManga() {
  try {
    const url = 'https://api.jikan.moe/v4/top/manga?page=1&limit=3';
    console.log(`Querying ${url}...`);
    const res = await axios.get(url);
    if (res.data && res.data.data && res.data.data.length > 0) {
      console.log('Sample Jikan Top Manga output:');
      const item = res.data.data[0];
      console.log(JSON.stringify({
        mal_id: item.mal_id,
        title: item.title,
        title_english: item.title_english,
        chapters: item.chapters,
        volumes: item.volumes,
        status: item.status,
        score: item.score,
        genres: item.genres?.map(g => g.name),
        authors: item.authors?.map(a => a.name),
        images: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url,
        synopsis: item.synopsis ? item.synopsis.substring(0, 100) + '...' : ''
      }, null, 2));
    } else {
      console.log('No results returned.');
    }
  } catch (err) {
    console.error('Error fetching Jikan manga:', err.message);
  }
}

testManga();
