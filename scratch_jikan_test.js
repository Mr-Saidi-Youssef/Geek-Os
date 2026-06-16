const axios = require('axios');

async function testReferer() {
  const jpgUrl = 'https://cdn.myanimelist.net/images/anime/1045/150038l.jpg';
  const webpUrl = 'https://cdn.myanimelist.net/images/anime/1045/150038l.webp';

  try {
    const resJpg = await axios.head(jpgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(`JPG status: ${resJpg.status}`);
  } catch (err) {
    console.log(`JPG error: ${err.message}`);
  }

  try {
    const resWebp = await axios.head(webpUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(`WEBP status: ${resWebp.status}`);
  } catch (err) {
    console.log(`WEBP error: ${err.message}`);
  }
}

testReferer();
