const axios = require('axios');

async function test() {
  try {
    const term = 'portal 2';
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=US`;
    console.log('Querying search:', searchUrl);
    const searchRes = await axios.get(searchUrl);
    console.log('Search response keys:', Object.keys(searchRes.data));
    console.log('Items found:', searchRes.data.items?.length);
    if (searchRes.data.items && searchRes.data.items.length > 0) {
      const item = searchRes.data.items[0];
      console.log('First item:', JSON.stringify(item, null, 2));

      // Get app details
      const appid = item.id;
      const detailsUrl = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
      console.log('Querying details:', detailsUrl);
      const detailsRes = await axios.get(detailsUrl);
      console.log('Details response keys:', Object.keys(detailsRes.data));
      console.log('App details status for appid:', detailsRes.data[appid]?.success);
      if (detailsRes.data[appid]?.success) {
        console.log('App data preview:', JSON.stringify(detailsRes.data[appid].data, (k, v) => {
          if (typeof v === 'string' && v.length > 200) return v.substring(0, 200) + '...';
          return v;
        }, 2));
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
