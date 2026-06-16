const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '7ab340245e7e4b22a3685608e103c0aa';

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error('Error: NOTION_TOKEN or NOTION_MOVIE_DATABASE_ID is not configured.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const EXTRA_MOVIES = [
  { title: 'Oppenheimer', director: 'Christopher Nolan', year: 2023, runtime: 180, rating: 8.4, genres: ['Drama', 'Biography', 'History'], synopsis: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.' },
  { title: 'Barbie', director: 'Greta Gerwig', year: 2023, runtime: 114, rating: 6.9, genres: ['Comedy', 'Fantasy'], synopsis: 'Barbie suffers a crisis that leads her to question her world and her existence.' },
  { title: 'Dune: Part Two', director: 'Denis Villeneuve', year: 2024, runtime: 166, rating: 8.6, genres: ['Action & Adventure', 'Sci-Fi', 'Drama'], synopsis: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.' },
  { title: 'Dune', director: 'Denis Villeneuve', year: 2021, runtime: 155, rating: 8.0, genres: ['Action & Adventure', 'Sci-Fi', 'Drama'], synopsis: 'A noble family becomes embroiled in a war for control over the galaxy\'s most valuable asset.' },
  { title: 'Avatar: The Way of Water', director: 'James Cameron', year: 2022, runtime: 192, rating: 7.6, genres: ['Action & Adventure', 'Sci-Fi', 'Fantasy'], synopsis: 'Jake Sully lives with his newfound family formed on the extrasolar moon Pandora.' },
  { title: 'Everything Everywhere All at Once', director: 'Daniel Kwan, Daniel Scheinert', year: 2022, runtime: 139, rating: 7.8, genres: ['Action & Adventure', 'Comedy', 'Sci-Fi', 'Fantasy'], synopsis: 'A middle-aged Chinese immigrant is swept up into an insane adventure in which she alone can save existence.' },
  { title: 'Spider-Man: No Way Home', director: 'Jon Watts', year: 2021, runtime: 148, rating: 8.2, genres: ['Action & Adventure', 'Fantasy', 'Sci-Fi'], synopsis: 'With Spider-Man\'s identity now revealed, Peter asks Doctor Strange for help.' },
  { title: 'Top Gun: Maverick', director: 'Joseph Kosinski', year: 2022, runtime: 130, rating: 8.3, genres: ['Action & Adventure', 'Drama'], synopsis: 'After thirty years, Maverick is still pushing the envelope as a top naval aviator.' },
  { title: 'La La Land', director: 'Damien Chazelle', year: 2016, runtime: 128, rating: 8.0, genres: ['Comedy', 'Drama', 'Romance'], synopsis: 'While navigating their careers in Los Angeles, a pianist and an actress fall in love.' },
  { title: 'Titanic', director: 'James Cameron', year: 1997, runtime: 194, rating: 7.9, genres: ['Drama', 'Romance'], synopsis: 'A seventeen-year-old aristocrat falls in love with a kind but poor artist aboard the luxurious, ill-fated R.M.S. Titanic.' },
  { title: 'Avatar', director: 'James Cameron', year: 2009, runtime: 162, rating: 7.9, genres: ['Action & Adventure', 'Sci-Fi', 'Fantasy'], synopsis: 'A paraplegic Marine dispatched to the moon Pandora on a unique mission becomes torn between following his orders and protecting the world he feels is his home.' },
  { title: 'The Avengers', director: 'Joss Whedon', year: 2012, runtime: 143, rating: 8.0, genres: ['Action & Adventure', 'Sci-Fi'], synopsis: 'Earth\'s mightiest heroes must come together and learn to fight as a team to stop the mischievous Loki.' },
  { title: 'Avengers: Endgame', director: 'Anthony Russo, Joe Russo', year: 2019, runtime: 181, rating: 8.4, genres: ['Action & Adventure', 'Sci-Fi', 'Drama'], synopsis: 'After the devastating events of Avengers: Infinity War, the universe is in ruins.' },
  { title: 'Avengers: Infinity War', director: 'Anthony Russo, Joe Russo', year: 2018, runtime: 149, rating: 8.4, genres: ['Action & Adventure', 'Sci-Fi'], synopsis: 'The Avengers and their allies must be willing to sacrifice all in an attempt to defeat the powerful Thanos.' },
  { title: 'The Dark Knight Rises', director: 'Christopher Nolan', year: 2012, runtime: 164, rating: 8.4, genres: ['Action & Adventure', 'Thriller', 'Drama'], synopsis: 'Eight years after the Joker\'s reign of anarchy, Batman is forced from his exile.' },
  { title: 'Black Panther', director: 'Ryan Coogler', year: 2018, runtime: 134, rating: 7.3, genres: ['Action & Adventure', 'Sci-Fi'], synopsis: 'T\'Challa, heir to the hidden and advanced kingdom of Wakanda, must step forward to lead his people.' },
  { title: 'Get Out', director: 'Jordan Peele', year: 2017, runtime: 104, rating: 7.8, genres: ['Horror', 'Thriller'], synopsis: 'A young African-American visits his white girlfriend\'s parents for the weekend, where he uncovers a disturbing secret.' },
  { title: 'Knives Out', director: 'Rian Johnson', year: 2019, runtime: 130, rating: 7.9, genres: ['Comedy', 'Crime', 'Thriller'], synopsis: 'A detective investigates the death of the patriarch of an eccentric, combative family.' },
  { title: 'Parasite', director: 'Bong Joon Ho', year: 2019, runtime: 132, rating: 8.5, genres: ['Drama', 'Thriller', 'Comedy'], synopsis: 'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.' },
  { title: 'Mad Max: Fury Road', director: 'George Miller', year: 2015, runtime: 120, rating: 8.1, genres: ['Action & Adventure', 'Sci-Fi'], synopsis: 'In a post-apocalyptic wasteland, a woman rebels against a tyrannical ruler in search for her homeland.' },
  { title: 'Interstellar', director: 'Christopher Nolan', year: 2014, runtime: 169, rating: 8.7, genres: ['Action & Adventure', 'Sci-Fi', 'Drama'], synopsis: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.' },
  { title: 'Inception', director: 'Christopher Nolan', year: 2010, runtime: 148, rating: 8.8, genres: ['Action & Adventure', 'Sci-Fi', 'Thriller'], synopsis: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea.' },
  { title: 'The Matrix', director: 'Lana Wachowski, Lilly Wachowski', year: 1999, runtime: 136, rating: 8.7, genres: ['Action & Adventure', 'Sci-Fi'], synopsis: 'When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth.' },
  { title: 'Gladiator', director: 'Ridley Scott', year: 2000, runtime: 155, rating: 8.5, genres: ['Action & Adventure', 'Drama'], synopsis: 'A former Roman General sets out to exact vengeance against the corrupt emperor who murdered his family.' },
  { title: 'Spider-Man: Into the Spider-Verse', director: 'Bob Persichetti, Peter Ramsey, Rodney Rothman', year: 2018, runtime: 117, rating: 8.4, genres: ['Animation', 'Action & Adventure', 'Sci-Fi'], synopsis: 'Teen Miles Morales becomes the Spider-Man of his universe, and must join with five spider-powered individuals from other dimensions.' },
  { title: 'Spider-Man: Across the Spider-Verse', director: 'Joaquim Dos Santos, Kemp Powers, Justin K. Thompson', year: 2023, runtime: 140, rating: 8.6, genres: ['Animation', 'Action & Adventure', 'Sci-Fi'], synopsis: 'Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence.' },
  { title: 'Whiplash', director: 'Damien Chazelle', year: 2014, runtime: 106, rating: 8.5, genres: ['Drama'], synopsis: 'A promising young drummer enrolls at a cut-throat music conservatory where his dreams of greatness are mentored by an abusive instructor.' },
  { title: 'The Wolf of Wall Street', director: 'Martin Scorsese', year: 2013, runtime: 180, rating: 8.2, genres: ['Biography', 'Comedy', 'Crime', 'Drama'], synopsis: 'Based on the true story of Jordan Belfort, from his rise to a wealthy stockbroker living the high life to his fall.' },
  { title: 'Django Unchained', director: 'Quentin Tarantino', year: 2012, runtime: 165, rating: 8.4, genres: ['Drama', 'Western'], synopsis: 'With the help of a German bounty-hunter, a freed slave sets out to rescue his wife from a brutal Mississippi plantation owner.' },
  { title: 'Inglourious Basterds', director: 'Quentin Tarantino', year: 2009, runtime: 153, rating: 8.3, genres: ['Action & Adventure', 'Drama'], synopsis: 'In Nazi-occupied France during World War II, a plan to assassinate Nazi leaders by a group of Jewish U.S. soldiers coincides with a theatre owner\'s vengeful plans.' },
  { title: 'The Grand Budapest Hotel', director: 'Wes Anderson', year: 2014, runtime: 99, rating: 8.1, genres: ['Adventure', 'Comedy', 'Drama'], synopsis: 'A writer relates his adventures at a renowned European resort between the first and second World Wars.' },
  { title: 'The Departed', director: 'Martin Scorsese', year: 2006, runtime: 151, rating: 8.5, genres: ['Crime', 'Drama', 'Thriller'], synopsis: 'An undercover cop and a mole in the police attempt to identify each other while infiltrating an Irish gang in South Boston.' },
  { title: 'No Country for Old Men', director: 'Ethan Coen, Joel Coen', year: 2007, runtime: 122, rating: 8.2, genres: ['Crime', 'Drama', 'Thriller'], synopsis: 'Violence and mayhem ensue after a hunter stumbles upon a drug deal gone wrong and more than two million dollars in cash.' },
  { title: 'The Prestige', director: 'Christopher Nolan', year: 2006, runtime: 130, rating: 8.5, genres: ['Drama', 'Sci-Fi', 'Thriller'], synopsis: 'After a tragic accident, two stage magicians in 1890s London engage in a battle to create the ultimate illusion.' },
  { title: 'Shutter Island', director: 'Martin Scorsese', year: 2010, runtime: 138, rating: 8.2, genres: ['Mystery', 'Thriller', 'Drama'], synopsis: 'In 1954, a U.S. Marshal investigates the disappearance of a murderer who escaped from a hospital for the criminally insane.' },
  { title: 'The Truman Show', director: 'Peter Weir', year: 1998, runtime: 103, rating: 8.2, genres: ['Comedy', 'Drama'], synopsis: 'An insurance salesman discovers his whole life is actually a reality TV show.' },
  { title: 'Arrival', director: 'Denis Villeneuve', year: 2016, runtime: 116, rating: 7.9, genres: ['Drama', 'Sci-Fi', 'Thriller'], synopsis: 'A linguist works with the military to communicate with alien-beings after twelve mysterious spacecraft appear around the world.' },
  { title: 'Inside Out', director: 'Pete Docter, Ronnie Del Carmen', year: 2015, runtime: 95, rating: 8.1, genres: ['Animation', 'Comedy', 'Drama'], synopsis: 'After a young girl is uprooted from her Midwest life and moved to San Francisco, her emotions conflict on how best to navigate.' },
  { title: 'Inside Out 2', director: 'Kelsey Mann', year: 2024, runtime: 96, rating: 7.7, genres: ['Animation', 'Comedy', 'Drama'], synopsis: 'Teenager Riley\'s mind headquarters undergoes a sudden demolition to make room for new Emotions!' },
  { title: 'Coco', director: 'Lee Unkrich, Adrian Molina', year: 2017, runtime: 105, rating: 8.4, genres: ['Animation', 'Comedy', 'Fantasy'], synopsis: 'Aspiring musician Miguel, confronted with his family\'s ancestral ban on music, enters the Land of the Dead.' },
  { title: 'Zootopia', director: 'Byron Howard, Rich Moore', year: 2016, runtime: 108, rating: 8.0, genres: ['Animation', 'Comedy', 'Crime'], synopsis: 'In a city of anthropomorphic animals, a rookie bunny cop and a cynical con artist fox must work together.' },
  { title: 'Your Name.', director: 'Makoto Shinkai', year: 2016, runtime: 106, rating: 8.4, genres: ['Animation', 'Drama', 'Fantasy'], synopsis: 'Two strangers find themselves linked in a bizarre way. When a connection is formed, will distance be the only thing to keep them apart?' },
  { title: 'Spirited Away', director: 'Hayao Miyazaki', year: 2001, runtime: 125, rating: 8.6, genres: ['Animation', 'Fantasy', 'Adventure'], synopsis: 'During her family\'s move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits.' },
  { title: 'Princess Mononoke', director: 'Hayao Miyazaki', year: 1997, runtime: 134, rating: 8.4, genres: ['Animation', 'Fantasy', 'Adventure'], synopsis: 'On a journey to find the cure for a Tatarigami\'s curse, Ashitaka finds himself in the middle of a war between the forest gods and Tatara, a mining colony.' },
  { title: 'Howl\'s Moving Castle', director: 'Hayao Miyazaki', year: 2004, runtime: 119, rating: 8.2, genres: ['Animation', 'Fantasy', 'Adventure'], synopsis: 'When an unconfident young woman is cursed with an old body by a spiteful witch, her only chance of breaking the spell lies with a self-indulgent yet insecure young wizard.' },
  { title: 'Guillermo del Toro\'s Pinocchio', director: 'Guillermo del Toro, Mark Gustafson', year: 2022, runtime: 117, rating: 7.6, genres: ['Animation', 'Drama', 'Fantasy'], synopsis: 'A father\'s wish magically brings a wooden boy to life in Italy, giving him a chance to care for the child.' },
  { title: 'Poor Things', director: 'Yorgos Lanthimos', year: 2023, runtime: 141, rating: 7.9, genres: ['Comedy', 'Drama', 'Romance'], synopsis: 'The incredible tale of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter.' },
  { title: 'Perfect Days', director: 'Wim Wenders', year: 2023, runtime: 124, rating: 7.9, genres: ['Drama'], synopsis: 'Hirayama seems utterly content with his simple life as a cleaner of toilets in Tokyo.' },
  { title: 'The Zone of Interest', director: 'Jonathan Glazer', year: 2023, runtime: 105, rating: 7.5, genres: ['Drama', 'History', 'War'], synopsis: 'The commandant of Auschwitz, Rudolf Höss, and his wife Hedwig, strive to build a dream life for their family in a house and garden next to the camp.' }
];

// Helper to clean OMDb thumb to full-res original cover
function getHighResPoster(url) {
  if (!url) return '';
  if (url.includes('m.media-amazon.com/images/')) {
    return url.replace(/@\._V1_.*\.jpg$/, '@.jpg');
  }
  return url;
}

// Keyless OMDb cover fetching
async function getOmdbCover(title) {
  try {
    const url = `http://www.omdbapi.com/?t=${encodeURIComponent(title)}&apikey=thewdb`;
    const res = await axios.get(url);
    if (res.data && res.data.Poster && res.data.Poster.startsWith('http') && !res.data.Poster.includes('N/A')) {
      return getHighResPoster(res.data.Poster);
    }
  } catch (err) {
    // Fail silently
  }
  return '';
}

// Keyless YouTube trailer fetching
async function getYoutubeTrailer(title, year) {
  try {
    const query = encodeURIComponent(`${title} ${year} official trailer`);
    const searchUrl = `https://www.youtube.com/results?search_query=${query}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  } catch (err) {
    // Fail silently
  }
  return '';
}

// Cache of existing movies in Notion
async function fetchNotionCache() {
  const cache = new Map();
  let hasMore = true;
  let cursor = undefined;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        let titleVal = '';
        for (const key of Object.keys(page.properties)) {
          const prop = page.properties[key];
          if (prop.type === 'title' && prop.title && prop.title.length > 0) {
            titleVal = prop.title[0].plain_text;
            break;
          }
        }
        if (titleVal) {
          cache.set(titleVal.toLowerCase().trim(), page.id);
        }
      }
      hasMore = response.has_more;
      cursor = response.next_cursor;
    }
    return cache;
  } catch (error) {
    console.error('Error fetching cache:', error.message);
    throw error;
  }
}

async function start() {
  console.log('====================================================');
  console.log('🚀 Seeding Curated Famous Movies to Notion Database...');
  console.log('====================================================');

  try {
    const cache = await fetchNotionCache();
    console.log(`Loaded cache: ${cache.size} existing movies found in Notion.`);

    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < EXTRA_MOVIES.length; i++) {
      const m = EXTRA_MOVIES[i];
      const cacheKey = m.title.toLowerCase().trim();

      if (cache.has(cacheKey)) {
        console.log(`[Skipping] "${m.title}" is already in your database.`);
        skipped++;
        continue;
      }

      console.log(`\nProcessing: "${m.title}" (${m.year})`);
      
      // Resolve Cover Art
      console.log(`  Resolving cover poster from OMDb...`);
      const coverUrl = await getOmdbCover(m.title);
      if (coverUrl) {
        console.log(`  Resolved Cover: ${coverUrl}`);
      } else {
        console.log(`  ⚠️ Failed to resolve cover.`);
      }

      // Resolve Trailer
      console.log(`  Searching YouTube trailer...`);
      const trailerUrl = await getYoutubeTrailer(m.title, m.year);
      if (trailerUrl) {
        console.log(`  Resolved Trailer: ${trailerUrl}`);
      } else {
        console.log(`  No trailer resolved.`);
      }

      // Build properties
      const properties = {
        'Title': { title: [{ text: { content: m.title } }] },
        'Director': { rich_text: [{ text: { content: m.director } }] },
        'Status': { status: { name: 'Plan to watch' } }, // Status is a 'status' type in Movies database!
        'Synopsis': { rich_text: [{ text: { content: m.synopsis } }] },
        'ReleaseYear': { number: m.year },
        'Runtime': { number: m.runtime },
        'IMDbRating': { number: m.rating },
        'Genre': { multi_select: m.genres.map(g => ({ name: g })) }
      };

      if (trailerUrl) {
        properties['Trailer'] = { url: trailerUrl };
      }

      const pageData = {
        parent: { database_id: DATABASE_ID },
        properties
      };

      if (coverUrl) {
        pageData.cover = {
          type: 'external',
          external: { url: coverUrl }
        };
      }

      try {
        console.log(`  [Inserting] "${m.title}" into Notion...`);
        await notion.pages.create(pageData);
        inserted++;
        await sleep(350); // safe limit delay
      } catch (err) {
        console.error(`  ⚠️ Failed to insert "${m.title}":`, err.message);
      }
    }

    console.log('\n====================================================');
    console.log('🎉 Seeding Extra Famous Movies Complete!');
    console.log(`🟢 Successfully Seeded: ${inserted} new masterpieces.`);
    console.log(`⚪ Skipped (Already existed): ${skipped}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in seeder:', error.message);
  }
}

start();
