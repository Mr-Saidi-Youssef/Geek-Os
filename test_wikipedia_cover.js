const axios = require('axios');

async function resolveWikipediaCover(title) {
  try {
    console.log(`Searching Wikipedia for: "${title}"`);
    // Step 1: Search Wikipedia for the game to get the exact page title
    const searchUrl = `https://en.wikipedia.org/w/api.php`;
    const searchRes = await axios.get(searchUrl, {
      params: {
        action: 'query',
        list: 'search',
        srsearch: `${title} video game`,
        format: 'json',
        utf8: 1
      },
      headers: {
        'User-Agent': 'ByronotionGameCoverResolver/1.0 (contact@byronotion.com)'
      },
      timeout: 8000
    });
    
    if (searchRes.data?.query?.search?.length > 0) {
      const bestMatch = searchRes.data.query.search[0];
      const exactTitle = bestMatch.title;
      console.log(`  -> Best Wikipedia Match: "${exactTitle}"`);
      
      // Step 2: Fetch the page image URL for this exact page
      const imageRes = await axios.get(searchUrl, {
        params: {
          action: 'query',
          prop: 'pageimages',
          piprop: 'original',
          titles: exactTitle,
          format: 'json',
          utf8: 1
        },
        headers: {
          'User-Agent': 'ByronotionGameCoverResolver/1.0 (contact@byronotion.com)'
        },
        timeout: 8000
      });
      
      const pages = imageRes.data?.query?.pages;
      if (pages) {
        const pageId = Object.keys(pages)[0];
        const originalImage = pages[pageId]?.original?.source;
        if (originalImage) {
          console.log(`  -> Resolved Wikipedia Image: ${originalImage}`);
          return originalImage;
        }
      }
    }
  } catch (err) {
    console.error(`  -> Wikipedia error for "${title}":`, err.message);
  }
  return '';
}

async function test() {
  const games = [
    'The Legend of Zelda: Ocarina of Time',
    'Maximo: Ghosts to Glory',
    'Super Street Fighter II Turbo: Revival',
    'Pokemon Ultra Sun',
    'Viva Pinata',
    'Sid Meier\'s SimGolf',
    'F1 2010',
    'Sound Shapes'
  ];
  
  for (const game of games) {
    const cover = await resolveWikipediaCover(game);
    console.log(`Result: ${game} -> ${cover || 'None'}\n`);
  }
}

test();
