const { Client } = require('@notionhq/client');
require('dotenv').config();
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const PAGE_ID = '370d0aaf-19d0-808e-993e-c17129f539c6'; // Inception — has template blocks

async function run() {
  const res = await notion.blocks.children.list({ block_id: PAGE_ID });
  console.log('INCEPTION TEMPLATE BLOCK STRUCTURE:\n');
  for (let i = 0; i < res.results.length; i++) {
    const b = res.results[i];
    let text = '';
    if (b[b.type] && b[b.type].rich_text) {
      text = b[b.type].rich_text.map(t => t.plain_text).join('');
    } else if (b.type === 'video') {
      text = (b.video && b.video.external) ? b.video.external.url : '(video)';
    }
    const color = (b[b.type] && b[b.type].color) ? b[b.type].color : '-';
    console.log('[' + i + '] TYPE=' + b.type + ' | HAS_CHILDREN=' + b.has_children + ' | COLOR=' + color);
    if (text) console.log('     TEXT: ' + text.substring(0, 80));

    if (b.has_children) {
      const cr = await notion.blocks.children.list({ block_id: b.id });
      for (const c of cr.results) {
        let ct = '';
        if (c[c.type] && c[c.type].rich_text) {
          ct = c[c.type].rich_text.map(t => t.plain_text).join('');
        }
        console.log('     CHILD: ' + c.type + ' | ' + ct.substring(0, 70));
      }
    }
    console.log('');
  }
}
run().catch(e => console.error(e.message));
