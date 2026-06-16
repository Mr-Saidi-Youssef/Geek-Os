const { Client } = require('@notionhq/client');
const fs = require('fs');

const token = "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";
const notion = new Client({ auth: token });

async function run() {
  try {
    console.log('Searching all authorized objects...');
    const response = await notion.search({ page_size: 100 });
    let output = `Found ${response.results.length} results:\n\n`;
    
    response.results.forEach(item => {
      let title = 'Untitled';
      if (item.object === 'database') {
        title = item.title?.map(t => t.plain_text).join('') || 'Untitled Database';
      } else if (item.object === 'page') {
        for (const prop of Object.values(item.properties || {})) {
          if (prop.type === 'title') {
            title = prop.title?.map(t => t.plain_text).join('') || 'Untitled Page';
            break;
          }
        }
      }
      output += `- Type: [${item.object}], Title: "${title}", ID: ${item.id}, Parent Type: ${item.parent?.type}, Parent ID: ${item.parent?.database_id || item.parent?.page_id || item.parent?.workspace ? 'Yes' : 'No'}\n`;
    });
    
    fs.writeFileSync('search_results.txt', output, 'utf8');
    console.log('Wrote results to search_results.txt');
  } catch (err) {
    console.error('Error querying Notion search:', err);
  }
}

run();
