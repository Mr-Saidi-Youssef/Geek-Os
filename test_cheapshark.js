const axios = require('axios');

async function resolveGameCover(title) {
  try {
    console.log(`Searching CheapShark for: "${title}"`);
    const searchUrl = `https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(title)}`;
    const res = await axios.get(searchUrl, { timeout: 10000 });
    
    if (res.data && res.data.length > 0) {
      // Find the first result that has a valid steamAppID
      const bestMatch = res.data.find(item => item.steamAppID && item.steamAppID !== 'null') || res.data[0];
      const appId = bestMatch.steamAppID;
      
      if (appId) {
        const coverUrl = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
        console.log(`  -> Match Found: "${bestMatch.external}"`);
        console.log(`  -> Steam App ID: ${appId}`);
        console.log(`  -> Resolved CDN Cover: ${coverUrl}`);
        
        // Verify cover URL is valid (returns 200)
        try {
          await axios.head(coverUrl, { timeout: 5000 });
          return coverUrl;
        } catch (e) {
          console.warn(`  -> Cover check failed for Steam App ID ${appId}, trying fallback...`);
        }
      }
      
      // Fallback: If no steamAppID or steam image failed, check thumb url
      if (bestMatch.thumb) {
        console.log(`  -> Fallback to Thumbnail: ${bestMatch.thumb}`);
        return bestMatch.thumb;
      }
    }
  } catch (err) {
    console.error(`  -> CheapShark error for "${title}":`, err.message);
  }
  return '';
}

async function test() {
  const games = [
    'Grand Theft Auto V',
    'The Witcher 3: Wild Hunt',
    'Cyberpunk 2077',
    'Hades',
    'Portal 2'
  ];
  
  for (const game of games) {
    const cover = await resolveGameCover(game);
    console.log(`Result: ${game} -> ${cover || 'None'}\n`);
  }
}

test();
