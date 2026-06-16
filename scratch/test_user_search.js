const { Client } = require('@notionhq/client');

const token = "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";
const notion = new Client({ auth: token });

async function run() {
  try {
    console.log('Searching all authorized objects...');
    const response = await notion.search({});
    console.log(`Found ${response.results.length} results:`);
    response.results.forEach(item => {
      let title = 'Untitled';
      if (item.object === 'database') {
        title = item.title?.map(t => t.plain_text).join('') || 'Untitled Database';
      } else if (item.object === 'page') {
        // Try to get title from page properties
        for (const prop of Object.values(item.properties || {})) {
          if (prop.type === 'title') {
            title = prop.title?.map(t => t.plain_text).join('') || 'Untitled Page';
            break;
          }
        }
      }
      console.log(`- Type: [${item.object}], Title: "${title}", ID: ${item.id}`);
    });
  } catch (err) {
    console.error('Error querying Notion search:', err);
  }
}

run();
