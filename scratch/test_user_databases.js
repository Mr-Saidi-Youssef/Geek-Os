const { Client } = require('@notionhq/client');

const token = "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";
const notion = new Client({ auth: token });

async function run() {
  try {
    console.log('Searching databases...');
    const response = await notion.search({
      filter: { property: 'object', value: 'database' }
    });
    console.log(`Found ${response.results.length} results:`);
    response.results.forEach(db => {
      const title = db.title?.map(t => t.plain_text).join('') || 'Untitled';
      console.log(`- Title: "${title}", ID: ${db.id}`);
    });
  } catch (err) {
    console.error('Error querying databases:', err);
  }
}

run();
