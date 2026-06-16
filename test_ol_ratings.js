const axios = require('axios');

async function testRatings() {
  const keys = ['OL34199W', 'OL27479W', 'OL32873W'];
  for (const key of keys) {
    try {
      const url = `https://openlibrary.org/works/${key}/ratings.json`;
      console.log(`Querying: ${url}`);
      const res = await axios.get(url);
      console.log('Response:', JSON.stringify(res.data, null, 2));
    } catch (err) {
      console.error(`Error for ${key}:`, err.message);
    }
  }
}

testRatings();
