/**
 * Master Watchlist Tracker Expansion Pipeline Orchestrator
 * Coordinates sequential, rate-limit safe seeding of Anime, Movies, and TV Series to 10,000 entries each.
 * Developed for Byronotion Watchlist Tracker
 */

const { spawn } = require('child_process');
const path = require('path');

const scripts = [
  { name: 'Anime Library (10,000)', file: 'import_top_anime_10k.js' },
  { name: 'Movies Library (10,000)', file: 'import_top_movies_10k.js' },
  { name: 'TV Series Library (10,000)', file: 'import_top_series_10k.js' }
];

function runScript(script) {
  return new Promise((resolve, reject) => {
    console.log('\n====================================================');
    console.log(`🎬 STARTING PHASE: Syncing ${script.name}...`);
    console.log(`   Running: node ${script.file}`);
    console.log('====================================================\n');

    const filePath = path.join(__dirname, script.file);
    const child = spawn('node', [filePath], { stdio: 'inherit', cwd: __dirname });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n====================================================`);
        console.log(`✅ COMPLETED PHASE: ${script.name} successfully synced!`);
        console.log('====================================================\n');
        resolve();
      } else {
        console.error(`\n❌ ERROR: Script ${script.file} exited with code ${code}`);
        // Resolve anyway to continue with other databases rather than blocking the entire pipeline
        resolve();
      }
    });

    child.on('error', (err) => {
      console.error(`❌ CRITICAL: Failed to start ${script.file}:`, err.message);
      resolve();
    });
  });
}

async function runPipeline() {
  console.log('====================================================');
  console.log('🚀 WATCHLIST TRACKER MASTER 10K SEEDING PIPELINE STARTING');
  console.log('====================================================');
  console.log('Scripts will run SEQUENTIALLY to prevent Notion API Rate-Limit Collisions.\n');

  const startTime = Date.now();

  for (const script of scripts) {
    await runScript(script);
  }

  const durationHrs = ((Date.now() - startTime) / (1000 * 60 * 60)).toFixed(2);

  console.log('====================================================');
  console.log(`🎉 ALL SEEDING PHASES COMPLETE!`);
  console.log(`⏱️  Total Pipeline Duration: ${durationHrs} hours.`);
  console.log('====================================================\n');
}

runPipeline();
