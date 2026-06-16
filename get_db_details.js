const { Client } = require('@notionhq/client');
const fs = require('fs');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const databases = {
  'Series': '36dd0aaf-19d0-8123-893f-cbaf9bff624a',
  'Library': '8b2780bf-d844-42d8-bcd9-5223152c0ece',
  'Movie Library': '7ab34024-5e7e-4b22-a368-5608e103c0aa',
  'Anime Library': '36dd0aaf-19d0-8007-92e7-dca0434c570c',
  'Stats Engine': '36dd0aaf-19d0-801e-b9f0-ea7695616f8d',
  'Notes': '367d0aaf-19d0-8092-8d00-ec8caca5505d',
  'Stats': '367d0aaf-19d0-809c-888b-d453e8800358',
  'Authors': '367d0aaf-19d0-803e-ac0a-d33d3c82c581',
  'Genres': '37d28afc-7789-44af-8035-2bb161318e31'
};

async function getDetails() {
  let log = '';
  for (const [name, id] of Object.entries(databases)) {
    try {
      const db = await notion.databases.retrieve({ database_id: id });
      log += `\n=========================================\n`;
      log += `Database: ${name} (${id})\n`;
      log += `Title: ${db.title[0]?.plain_text || 'Untitled'}\n`;
      log += `Properties:\n`;
      for (const [propName, propVal] of Object.entries(db.properties)) {
        let details = `type: ${propVal.type}`;
        if (propVal.type === 'select') {
          details += ` (options: ${propVal.select.options.map(o => o.name).join(', ')})`;
        } else if (propVal.type === 'multi_select') {
          details += ` (options: ${propVal.multi_select.options.map(o => o.name).join(', ')})`;
        } else if (propVal.type === 'relation') {
          details += ` (related_to: ${propVal.relation.database_id})`;
        } else if (propVal.type === 'formula') {
          details += ` (formula: ${propVal.formula.expression})`;
        }
        log += `  - ${propName}: ${details}\n`;
      }
    } catch (err) {
      log += `\nError retrieving ${name}: ${err.message}\n`;
    }
  }
  fs.writeFileSync('db_details_output.txt', log);
  console.log('Saved output to db_details_output.txt');
}

getDetails();
