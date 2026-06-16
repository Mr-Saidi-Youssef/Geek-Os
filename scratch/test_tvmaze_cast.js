const axios = require('axios');

async function test() {
  const showName = 'Breaking Bad';
  console.log(`Querying TVMaze for: "${showName}"...`);
  try {
    const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(showName)}&embed[]=cast&embed[]=crew`;
    const response = await axios.get(url);
    const show = response.data;
    
    if (show && show._embedded) {
      console.log('Embedded keys:', Object.keys(show._embedded));
      
      if (show._embedded.cast) {
        console.log('\n--- CAST (top 5) ---');
        show._embedded.cast.slice(0, 5).forEach(c => {
          console.log(`Person: ${c.person.name} | Character: ${c.character.name}`);
        });
      }
      
      if (show._embedded.crew) {
        console.log('\n--- CREW (top 10) ---');
        show._embedded.crew.slice(0, 10).forEach(cr => {
          console.log(`Person: ${cr.person.name} | Type: ${cr.type}`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
