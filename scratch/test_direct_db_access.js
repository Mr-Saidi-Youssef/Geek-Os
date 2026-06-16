const { Client } = require('@notionhq/client');

const token = "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";
const notion = new Client({ auth: token });

async function testAccess(dbId, name) {
  try {
    console.log(`Testing direct access to "${name}" (ID: ${dbId})...`);
    const db = await notion.databases.retrieve({ database_id: dbId });
    console.log(`✅ SUCCESS! Found database "${db.title?.map(t => t.plain_text).join('')}"`);
  } catch (err) {
    console.error(`❌ FAILED for "${name}":`, err.message);
  }
}

async function run() {
  // Books Library
  await testAccess('8b2780bf-d844-42d8-bcd9-5223152c0ece', 'Books Library');
  // Games Library
  await testAccess('36fd0aaf-19d0-815b-b5d3-d51ed587a7d1', 'Games Library');
  // Manga (default developer ID just in case)
  await testAccess('370d0aaf-19d0-8121-a36f-f3dfcc914532', 'Manga Library (Dev ID)');
}

run();
