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

async function test() {
  const url = 'https://raw.githubusercontent.com/prasertcbs/basic-dataset/master/metacritic_games.csv';
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
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
