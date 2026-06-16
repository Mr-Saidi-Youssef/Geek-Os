const fetch = require('node-fetch'); // wait, the test script runs in Node 18+ which has global fetch, but we can just use global fetch since node has it.
// If fetch is not defined, we can import axios or do a fetch.
async function testArcane() {
  console.log('🧪 Testing Search & Add for TV Series "Arcane"...');
  try {
    const searchUrl = `http://localhost:8080/api/search/tv?q=Arcane`;
    console.log(`   Querying search: ${searchUrl}`);
    const searchRes = await fetch(searchUrl);
    const results = await searchRes.json();

    if (searchRes.status !== 200) {
      console.error(`   ❌ Search failed with status: ${searchRes.status}`, results);
      return;
    }

    console.log(`   ✓ Search succeeded. Found ${results.length} results.`);
    if (results.length === 0) {
      console.error(`   ❌ No results found for query: Arcane`);
      return;
    }

    const topResult = results[0];
    console.log(`   ✓ Top result title: "${topResult.title}"`);
    console.log(`   ✓ Metadata:`, JSON.stringify(topResult.metadata, null, 2));

    // Run Addition
    const addPayload = {
      type: 'tv',
      title: topResult.title,
      cover: topResult.cover,
      year: topResult.year,
      genres: topResult.genres,
      synopsis: topResult.synopsis,
      metadata: topResult.metadata
    };

    console.log(`   Adding to Notion via POST /api/add...`);
    const addRes = await fetch('http://localhost:8080/api/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addPayload)
    });
    const addResult = await addRes.json();

    if (addRes.status !== 200) {
      console.error(`   ❌ Addition failed with status: ${addRes.status}`, addResult);
    } else {
      console.log(`   ✅ Success! Notion page created.`);
      console.log(`      Page ID: ${addResult.pageId}`);
      console.log(`      Notion URL: ${addResult.url}`);
    }
  } catch (err) {
    console.error(`   ❌ Test failed with error:`, err.message);
  }
}

testArcane();
