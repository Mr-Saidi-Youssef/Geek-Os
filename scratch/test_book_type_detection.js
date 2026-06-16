const axios = require('axios');

function detectBookType(genres, title, synopsis) {
  const nonFictionKeywords = [
    'self-help', 'business', 'economics', 'finance', 'biography', 'autobiography', 'memoir',
    'history', 'psychology', 'science', 'technology', 'philosophy', 'religion', 'education',
    'health', 'fitness', 'diet', 'cooking', 'travel', 'art', 'design', 'photography', 'crafts',
    'political', 'politics', 'sociology', 'anthropology', 'parenting', 'relationships',
    'personal development', 'productivity', 'reference', 'essay', 'essays', 'true crime'
  ];
  
  const allText = [
    ...(genres || []),
    title || '',
    synopsis || ''
  ].join(' ').toLowerCase();

  console.log('All text for detection:', allText);

  for (const keyword of nonFictionKeywords) {
    if (allText.includes(keyword)) {
      console.log(`Matched keyword: "${keyword}"`);
      return 'Non-Fiction';
    }
  }
  return 'Fiction';
}

async function run() {
  const q = 'Atomic Habits';
  const response = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`);
  const item = response.data.items[0];
  const vol = item.volumeInfo;
  console.log('Google Books categories:', vol.categories);
  console.log('Google Books title:', vol.title);
  console.log('Google Books description:', vol.description ? vol.description.substring(0, 100) : 'none');
  
  const type = detectBookType(vol.categories, vol.title, vol.description);
  console.log('Detected Type:', type);
}

run();
