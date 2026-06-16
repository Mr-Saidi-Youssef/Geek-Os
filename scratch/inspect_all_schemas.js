const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const DB_IDS = {
  anime: '36dd0aaf19d0800792e7dca0434c570c',
  manga: '370d0aaf-19d0-8121-a36f-f3dfcc914532',
  game: '36fd0aaf-19d0-815b-b5d3-d51ed587a7d1',
  book: '8b2780bfd84442d8bcd95223152c0ece'
};

async function inspect(name, id) {
  try {
    const db = await notion.databases.retrieve({ database_id: id });
    console.log(`\n======================================`);
    console.log(`SCHEMA FOR: ${name.toUpperCase()} (${id})`);
    console.log(`======================================`);
    for (const [propName, prop] of Object.entries(db.properties)) {
      if (prop.type === 'select') {
        console.log(`Select Property "${propName}": options = [${prop.select.options.map(o => o.name).join(', ')}]`);
      } else if (prop.type === 'status') {
        console.log(`Status Property "${propName}": options = [${prop.status.options.map(o => o.name).join(', ')}]`);
      } else if (prop.type === 'multi_select') {
        console.log(`Multi-select Property "${propName}": options = [${prop.multi_select.options.map(o => o.name).join(', ')}]`);
      } else {
        console.log(`Property "${propName}": type = ${prop.type}`);
      }
    }
  } catch (err) {
    console.error(`Error inspecting ${name}:`, err.message);
  }
}

async function run() {
  for (const [name, id] of Object.entries(DB_IDS)) {
    await inspect(name, id);
  }
}

run();
