const axios = require('axios');

async function test() {
  const showName = 'Breaking Bad';
  console.log(`Querying TVMaze for: "${showName}"...`);
  try {
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(showName)}&embed[]=seasons&embed[]=episodes`;
    const response = await axios.get(url);
    const show = response.data;
    
    if (show && show._embedded && show._embedded.episodes) {
      const episodes = show._embedded.episodes;
      console.log(`Found ${episodes.length} episodes total across seasons.`);
      
      // Group by season
      const seasons = {};
      episodes.forEach(ep => {
        if (!seasons[ep.season]) {
          seasons[ep.season] = [];
        }
        seasons[ep.season].push(ep);
      });

      // Print first season as sample
      console.log('\n--- SEASON 1 SAMPLE ---');
      const s1 = seasons[1] || [];
      s1.forEach(ep => {
        console.log(`S1E${ep.number}: "${ep.name}"`);
      });
    } else {
      console.log('No episodes found embedded.');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
