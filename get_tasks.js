const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = '165d0aaf19d08174870ed859a6a73243';

async function fetchTasks() {
  console.log('Querying Tasks database from Notion...');
  try {
    const response = await notion.databases.query({
      database_id: databaseId
    });

    console.log(JSON.stringify(response.results, null, 2));
  } catch (error) {
    console.error('Error fetching tasks:', error.message);
  }
}

fetchTasks();
