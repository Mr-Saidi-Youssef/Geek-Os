const fs = require('fs');
const path = require('path');
const axios = require('axios');

const urls = {
  "taylor_swift.jpg": "https://m.media-amazon.com/images/M/MV5BYjRiZDI3ZmYtZTk0Ni00MzEwLWIwMWEtMTgwY2VmM2IwNjk2XkEyXkFqcGdeQXVyMTEzNjM5MDg1._V1_SX300.jpg",
  "kill_bill.jpg": "https://m.media-amazon.com/images/M/MV5BZDc2YzhkODAtZmRmZS00YzcxLWJkYWEtM2ZhZjY3MmMyZmJiXkEyXkFqcGc@.jpg",
  "goodfellas.jpg": "https://m.media-amazon.com/images/M/MV5BY2NkZjEzMDgtN2RjYy00YzM1LWI4ZmQtMjIwYjFjNmI3ZGEwXkEyXkFqcGdeQXVyNzkwMjQ5NzM@.jpg"
};

const outputDir = 'C:\\Users\\ULTRAPC\\.gemini\\antigravity\\brain\\b628f3dc-fd66-4e09-94ef-86d6a2c36c93';

async function download() {
  for (const [filename, url] of Object.entries(urls)) {
    const outputPath = path.join(outputDir, filename);
    console.log(`Downloading ${filename} from ${url}...`);
    try {
      const res = await axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      res.data.pipe(fs.createWriteStream(outputPath));
      console.log(`  -> Saved to ${outputPath}`);
    } catch (err) {
      console.log(`  -> Failed: ${err.message}`);
    }
  }
}

download();
