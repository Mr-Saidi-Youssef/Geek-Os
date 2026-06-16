const { Client } = require('@notionhq/client');

const token = "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";
const notion = new Client({ auth: token });

async function inspect(pageId, name) {
  try {
    console.log(`\n========================================`);
    console.log(`Inspecting page "${name}" (ID: ${pageId}):`);
    const res = await notion.blocks.children.list({ block_id: pageId });
    console.log(`Found ${res.results.length} children blocks:`);
    res.results.forEach((block, idx) => {
      console.log(`${idx + 1}. Type: [${block.type}], ID: ${block.id}`);
      if (block.type === 'child_database') {
        console.log(`   👉 CHILD DATABASE: "${block.child_database.title}"`);
      }
      if (block.type === 'child_page') {
        console.log(`   👉 CHILD PAGE: "${block.child_page.title}"`);
      }
      if (block.type === 'link_to_page') {
        console.log(`   👉 LINK TO PAGE:`, block.link_to_page);
      }
    });
    console.log(`========================================`);
  } catch (err) {
    console.error(`Error inspecting page ${name}:`, err.message);
  }
}

async function run() {
  // Books Page ID: 367d0aaf-19d0-80ae-a661-cb90ecc00e21
  await inspect('367d0aaf-19d0-80ae-a661-cb90ecc00e21', 'Books');
  
  // Games Page ID: 36bd0aaf-19d0-8039-b1df-fb867c316ea8
  await inspect('36bd0aaf-19d0-8039-b1df-fb867c316ea8', 'Games');
}

run();
