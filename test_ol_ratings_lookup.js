const axios = require('axios');

async function testFetchRating(title) {
  console.log(`Searching for "${title}" on Open Library...`);
  
  // Clean up title
  const cleanTitle = title
    .replace(/,?\s*vol\.?\s*\d+/gi, '')
    .replace(/,?\s*book\s+\d+/gi, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim();

  try {
    // Step 1: Search for the work key
    const searchRes = await axios.get('https://openlibrary.org/search.json', {
      params: { q: cleanTitle, limit: 1 },
      timeout: 8000
    });

    const doc = searchRes.data?.docs?.[0];
    if (!doc) {
      console.log(`❌ No work found for "${title}"`);
      return;
    }

    const key = doc.key.replace('/works/', '');
    console.log(`✔ Found OL Key: ${key} for "${doc.title}"`);

    // Step 2: Fetch the actual rating from the work ratings endpoint
    const ratingsUrl = `https://openlibrary.org/works/${key}/ratings.json`;
    console.log(`Querying ratings endpoint: ${ratingsUrl}...`);
    
    const ratingsRes = await axios.get(ratingsUrl, { timeout: 6000 });
    const summary = ratingsRes.data?.summary;
    
    if (summary && summary.average) {
      const rating = parseFloat(summary.average.toFixed(2));
      console.log(`⭐ Success! Rating for "${title}": ${rating} (based on ${summary.count} ratings)\n`);
    } else {
      console.log(`⚠ No rating summary found in OL ratings endpoint for "${title}". Data:`, ratingsRes.data, '\n');
    }

  } catch (err) {
    console.error(`❌ Error for "${title}":`, err.message, '\n');
  }
}

async function run() {
  await testFetchRating("Welcome to Tranquility");
  await testFetchRating("Superman Chronicles, Vol. 3");
  await testFetchRating("American Vampire");
}

run();
