const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const TARGET_PAGE_ID = '36dd0aaf-19d0-81f5-b782-fc4ff99de443'; // Oldeuboi page id

const templateIcon = {
  type: 'icon',
  icon: {
    name: 'movie-camera',
    color: 'gray'
  }
};

async function test() {
  console.log('Testing page update with icon...');
  try {
    const response = await notion.pages.update({
      page_id: TARGET_PAGE_ID,
      icon: templateIcon
    });
    console.log('Success! Icon set:', JSON.stringify(response.icon, null, 2));
  } catch (error) {
    console.log('Error caught:', error.message);
    if (error.body) {
      console.log('Error body:', error.body);
    }
  }
}

test();
