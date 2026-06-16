const axios = require('axios');

function unescapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
}

async function resolveWikipediaCoverHTML(title) {
  try {
    console.log(`Searching Wikipedia HTML for: "${title}"`);
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
      
      // Step 2: Fetch raw HTML of the Wikipedia page
      const articleUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(exactTitle.replace(/ /g, '_'))}`;
      const articleRes = await axios.get(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });
      
      const html = articleRes.data;
      
      // Find infobox image tag: look for class="infobox" and scrape the first image inside it
      // Let's use a regex to find the first image in the infobox
      const infoboxMatch = html.match(/<table class="infobox[^>]*>([\s\S]*?)<\/table>/);
      if (infoboxMatch) {
        const infoboxHtml = infoboxMatch[1];
        const imgMatch = infoboxHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/);
        if (imgMatch) {
          let thumbUrl = imgMatch[1];
          if (thumbUrl.startsWith('//')) {
            thumbUrl = 'https:' + thumbUrl;
          }
          
          console.log(`  -> Found Thumbnail URL: ${thumbUrl}`);
          
          // Upscale Wikimedia thumbnail URL:
          // Pattern: /wikipedia/en/thumb/X/XX/filename.jpg/220px-filename.jpg
          // To get full res: strip "/thumb" and the trailing "/220px-..." segment
          let fullResUrl = thumbUrl;
          if (thumbUrl.includes('/wikipedia/en/thumb/') || thumbUrl.includes('/wikipedia/commons/thumb/')) {
            // Replace /thumb/ with /
            let temp = thumbUrl.replace('/thumb/', '/');
            // Strip the trailing slash and anything after it (the resize suffix)
            // e.g. /220px-Ocarina_of_Time_box_art.jpg
            const lastSlashIdx = temp.lastIndexOf('/');
            if (lastSlashIdx !== -1) {
              fullResUrl = temp.substring(0, lastSlashIdx);
            }
          }
          
          console.log(`  -> Resolved High-Res Cover: ${fullResUrl}`);
          return fullResUrl;
        }
      }
    }
  } catch (err) {
    console.error(`  -> Wikipedia HTML error for "${title}":`, err.message);
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
    const cover = await resolveWikipediaCoverHTML(game);
    console.log(`Result: ${game} -> ${cover || 'None'}\n`);
  }
}

test();
