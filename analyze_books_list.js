const fs = require('fs');
const path = require('path');

const filePath = 'd:\\Work\\Second Brain\\Projects\\Products\\Watchlist Tracker\\Package\\import_top_books.js';
const code = fs.readFileSync(filePath, 'utf8');

// We can just extract the BOOKS array using regex or simple indexing
const startIdx = code.indexOf('const BOOKS = [');
const endIdx = code.indexOf('];', startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('BOOKS array not found');
  process.exit(1);
}

const booksSegment = code.substring(startIdx, endIdx + 2);
const cleanCode = booksSegment.replace('const BOOKS =', 'module.exports =') + '\n';

try {
  const tempFile = 'd:\\Work\\Second Brain\\Projects\\Products\\Watchlist Tracker\\Package\\temp_books.js';
  fs.writeFileSync(tempFile, cleanCode, 'utf8');
  const books = require(tempFile);
  fs.unlinkSync(tempFile);
  
  console.log(`Total books in list: ${books.length}`);
  
  const authors = new Set();
  const genres = new Set();
  const types = new Set();
  
  for (const b of books) {
    if (b.author) authors.add(b.author.trim());
    if (b.genre) genres.add(b.genre.trim());
    if (b.type) types.add(b.type.trim());
  }
  
  console.log(`Unique Authors: ${authors.size}`);
  console.log(`Unique Genres: ${genres.size}`);
  console.log(`Unique Types: ${Array.from(types)}`);
} catch (e) {
  console.error('Error analyzing books:', e.message);
}
