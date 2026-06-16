const { Client } = require('@notionhq/client');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TEMPLATE_ID = '372d0aaf19d080b7a8f5dc7020ea2f21';
const notion = new Client({ auth: NOTION_TOKEN });

async function inspectTemplateSynopsis() {
  console.log(`Inspecting Template callout blocks (${TEMPLATE_ID})...`);
  try {
    const res = await notion.blocks.children.list({ block_id: TEMPLATE_ID });
    
    for (const block of res.results) {
      if (block.type === 'callout') {
        const text = block.callout.rich_text?.map(t => t.plain_text).join('') || '';
        console.log(`\nCallout block found (ID: ${block.id}) with text: "${text}"`);
        
        if (block.has_children) {
          const children = await notion.blocks.children.list({ block_id: block.id });
          console.log(`Nested children inside Callout:`);
          for (const child of children.results) {
            let childText = '';
            if (child.type === 'paragraph') {
              childText = child.paragraph.rich_text?.map(t => t.plain_text).join('') || '';
            }
            console.log(`- [${child.type}] (ID: ${child.id}): "${childText}"`);
          }
        } else {
          console.log(`- Callout has no children!`);
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectTemplateSynopsis();
