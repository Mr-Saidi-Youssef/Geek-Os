const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = '370d0aaf19d08121a36ff3dfcc914532';

async function check() {
  try {
    const db = await notion.databases.retrieve({ database_id: DB_ID });
    console.log(`Database Title: ${db.title[0]?.plain_text}`);
    console.log(`Status Property Details:`);
    const statusProp = db.properties['Status'];
    console.log(JSON.stringify(statusProp, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
