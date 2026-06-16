const { Client } = require('@notionhq/client');

const token = "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";
const notion = new Client({ auth: token });

async function run() {
  try {
    console.log('Searching all authorized databases (paginated)...');
    let hasMore = true;
    let startCursor = undefined;
    let allDatabases = [];
    
    while (hasMore) {
      const response = await notion.search({
        start_cursor: startCursor,
        page_size: 100
      });
      
      const dbs = response.results.filter(item => item.object === 'database');
      allDatabases = allDatabases.concat(dbs);
      
      hasMore = response.has_more;
      startCursor = response.next_cursor;
    }
    
    console.log(`\n========================================`);
    console.log(`SUCCESS: Found a total of ${allDatabases.length} databases:`);
    allDatabases.forEach(db => {
      const title = db.title?.map(t => t.plain_text).join('') || 'Untitled Database';
      console.log(`- Title: "${title}"\n  ID: ${db.id}\n  Parent type: ${db.parent?.type}`);
    });
    console.log(`========================================\n`);
  } catch (err) {
    console.error('Error querying Notion search:', err);
  }
}

run();
