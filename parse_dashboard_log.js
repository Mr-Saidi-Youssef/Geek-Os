const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\ULTRAPC\\.gemini\\antigravity\\brain\\b628f3dc-fd66-4e09-94ef-86d6a2c36c93\\.system_generated\\tasks\\task-5502.log';

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  const exactDashboardPages = {};
  const targets = ['Series', 'Anime', 'Manga', 'Comics', 'Games', 'Books'];

  for (const line of lines) {
    if (line.includes('- Page: "')) {
      const match = line.match(/- Page: "([^"]+)" \| ID: ([a-f0-9-]+)/);
      if (match) {
        const title = match[1].trim();
        const id = match[2];
        if (targets.includes(title)) {
          exactDashboardPages[title] = id;
        }
      }
    }
  }

  console.log('Parsed exact dashboard pages from logs:');
  console.log(JSON.stringify(exactDashboardPages, null, 2));
} else {
  console.log('Log file does not exist at:', logPath);
}
