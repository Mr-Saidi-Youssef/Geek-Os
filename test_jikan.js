const axios = require('axios');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testJikan(title) {
  try {
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`;
    const res = await axios.get(url);
    if (res.data && res.data.data && res.data.data.length > 0) {
      const item = res.data.data[0];
      console.log(`\nJikan match for "${title}":`);
      console.log(`  Title: "${item.title}"`);
      console.log(`  English Title: "${item.title_english}"`);
      console.log(`  Japanese Title: "${item.title_japanese}"`);
      console.log(`  Type: "${item.type}"`);
      console.log(`  Score: ${item.score}`);
    } else {
      console.log(`\nJikan: No results for "${title}"`);
    }
  } catch (err) {
    console.error(`Jikan error for "${title}":`, err.message);
  }
}

async function run() {
  await testJikan('Fairy Tail the Movie: Phoenix Priestess');
  await sleep(1000);
  await testJikan('Biohazard: Damnation');
}

run();
