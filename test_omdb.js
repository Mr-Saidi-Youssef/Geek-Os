const axios = require('axios');

async function testOMDb(title) {
  try {
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&type=movie&apikey=thewdb`;
    const res = await axios.get(url);
    console.log(`Title: "${title}"`);
    console.log('OMDb Response:', res.data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function run() {
  await testOMDb('Fairy Tail the Movie: Phoenix Priestess');
  await testOMDb('Biohazard: Damnation');
}

run();
