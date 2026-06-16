const axios = require('axios');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function testUrl(url) {
  console.log('Downloading CSV from:', url);
  try {
    const res = await axios.get(url, { timeout: 15000 });
    const lines = res.data.split('\n');
    console.log('Total raw lines:', lines.length);
    const headers = parseCSVLine(lines[0]);
    console.log('Headers:', headers);
    
    console.log('\nFirst 5 entries:');
    for (let i = 1; i <= Math.min(5, lines.length - 1); i++) {
      const row = parseCSVLine(lines[i].trim());
      console.log(`[Row ${i}]`, row);
    }
    return true;
  } catch (e) {
    console.error('Error fetching from', url, ':', e.message);
    return false;
  }
}

async function run() {
  const urls = [
    'https://raw.githubusercontent.com/StadynR/metacritic-reviews-dataset/master/metacritic_dataset_clean.csv',
    'https://raw.githubusercontent.com/StadynR/metacritic-reviews-dataset/main/metacritic_dataset_clean.csv',
    'https://raw.githubusercontent.com/StadynR/metacritic-reviews-dataset/master/metacritic_dataset_raw.csv',
    'https://raw.githubusercontent.com/StadynR/metacritic-reviews-dataset/main/metacritic_dataset_raw.csv'
  ];
  
  for (const url of urls) {
    const success = await testUrl(url);
    if (success) break;
  }
}

run();
