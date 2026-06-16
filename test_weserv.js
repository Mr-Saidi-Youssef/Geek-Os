const axios = require('axios');

const urls = {
  'Disaster: Day of Crisis (Direct Wikipedia)': 'https://upload.wikimedia.org/wikipedia/en/2/2f/Disaster_Day_of_Crisis.jpg',
  'Disaster: Day of Crisis (via Weserv Proxy)': 'https://images.weserv.nl/?url=https://upload.wikimedia.org/wikipedia/en/2/2f/Disaster_Day_of_Crisis.jpg',
  'Fresh Tracks (via Weserv Proxy)': 'https://images.weserv.nl/?url=https://m.media-amazon.com/images/M/MV5BZjgyNmE4MWItYzYzMC00ODAyLWEwNTctMGE2ZmY1MjZlOWNjXkEyXkFqcGdeQXVyNTM3MDMyMDQ@.jpg',
  'Looney Tunes: Sheep Raider (via Weserv Proxy)': 'https://images.weserv.nl/?url=https://upload.wikimedia.org/wikipedia/en/8/8c/Sheep_Dog_n_Wolf.jpg'
};

async function test() {
  console.log('Testing Weserv proxy live HTTP requests...\n');
  for (const [name, url] of Object.entries(urls)) {
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 4000
      });
      console.log(`"${name}" - GET: ${res.status} (OK)`);
    } catch (err) {
      console.log(`"${name}" - GET failed: ${err.message}`);
    }
  }
}

test();
