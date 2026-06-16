/**
 * run_books_import_pipeline.js
 * Orchestrates the books database pipeline consecutively to prevent Notion API rate limit conflicts:
 * 1. Executes repair_book_covers.js to upgrade all 3,378 existing books to high-res covers.
 * 2. Launches import_and_link_books.js to seed the remaining new books in high-res.
 */

const { spawn } = require('child_process');
const path = require('path');

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n====================================================`);
    console.log(`🎬 Pipeline: Starting execution of ${scriptName}...`);
    console.log(`====================================================\n`);

    const child = spawn('node', [scriptName], {
      cwd: __dirname,
      stdio: 'inherit' // Inherit stdio to see live logs in the console
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n====================================================`);
        console.log(`✅ Pipeline: ${scriptName} completed successfully!`);
        console.log(`====================================================\n`);
        resolve();
      } else {
        console.error(`\n====================================================`);
        console.error(`❌ Pipeline: ${scriptName} exited with code ${code}.`);
        console.error(`====================================================\n`);
        reject(new Error(`${scriptName} failed`));
      }
    });
  });
}

async function run() {
  console.log('====================================================');
  console.log('📚 Launching Master Books Pipeline Orchestrator...');
  console.log('====================================================\n');

  try {
    // Phase 1: Repair and upgrade covers of all existing books
    await runScript('repair_book_covers.js');

    // Phase 2: Import all remaining books in high-resolution
    await runScript('import_and_link_books.js');

    console.log('====================================================');
    console.log('🎉 MASTER BOOKS PIPELINE COMPLETED SUCCESSFULLY!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ Master Books Pipeline failed:', err.message);
  }
}

run();
