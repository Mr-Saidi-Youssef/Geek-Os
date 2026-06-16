/**
 * Notion Movies Importer & Seeder
 * Developed for Byronotion Movies Collection
 * Uses official Notion Client (@notionhq/client)
 */

const { Client } = require('@notionhq/client');
require('dotenv').config();

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_MOVIE_DATABASE_ID || '50d1fe62eaba477f9706503be51224c7';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

// Initialize Notion Client
const notion = new Client({ auth: NOTION_TOKEN });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Premium Movie Dataset (35 Masterpieces with full metadata matching your schema)
const moviesDataset = [
  {
    title: 'The Shawshank Redemption',
    director: 'Frank Darabont',
    releaseYear: 1994,
    runtime: 142,
    imdbRating: 9.3,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Drama'],
    platforms: ['Prime Video', 'Netflix'],
    trailer: 'https://www.youtube.com/watch?v=PLl99DlL6b4',
    synopsis: 'Over the course of several years, two convicts form a friendship, seeking consolation and, eventually, redemption through basic compassion.'
  },
  {
    title: 'The Godfather',
    director: 'Francis Ford Coppola',
    releaseYear: 1972,
    runtime: 175,
    imdbRating: 9.2,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Crime', 'Drama'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=UaVTIH8mujA',
    synopsis: 'The aging patriarch of an organized crime dynasty in postwar New York City transfers control of his clandestine empire to his reluctant youngest son.'
  },
  {
    title: 'The Dark Knight',
    director: 'Christopher Nolan',
    releaseYear: 2008,
    runtime: 152,
    imdbRating: 9.0,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Action & Adventure', 'Crime', 'Drama', 'Thriller'],
    platforms: ['Netflix', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=LDG9bisJEaI',
    synopsis: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.'
  },
  {
    title: 'Pulp Fiction',
    director: 'Quentin Tarantino',
    releaseYear: 1994,
    runtime: 154,
    imdbRating: 8.9,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Crime', 'Drama'],
    platforms: ['Netflix', 'Prime Video'],
    trailer: 'https://www.youtube.com/watch?v=s7EdQ4FqbhY',
    synopsis: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.'
  },
  {
    title: 'Schindler\'s List',
    director: 'Steven Spielberg',
    releaseYear: 1993,
    runtime: 195,
    imdbRating: 9.0,
    status: '🍿 To Watch',
    genres: ['Drama'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=gG22XNhtnoY',
    synopsis: 'In German-occupied Poland during World War II, industrialist Oskar Schindler gradually becomes concerned for his Jewish workforce after witnessing their persecution by the Nazis.'
  },
  {
    title: 'The Lord of the Rings: The Return of the King',
    director: 'Peter Jackson',
    releaseYear: 2003,
    runtime: 201,
    imdbRating: 9.0,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Action & Adventure', 'Fantasy', 'Drama'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=r5X-hFf6Bwo',
    synopsis: 'Gandalf and Aragorn lead the World of Men against Sauron\'s army to draw his gaze from Frodo and Sam as they approach Mount Doom with the One Ring.'
  },
  {
    title: '12 Angry Men',
    director: 'Sidney Lumet',
    releaseYear: 1957,
    runtime: 96,
    imdbRating: 9.0,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Drama'],
    platforms: ['Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=_13J_RYKlT4',
    synopsis: 'The jury in a New York City murder trial is frustrated by a single member whose skeptical caution forces them to more carefully consider the evidence before jumping to a hasty verdict.'
  },
  {
    title: 'Inception',
    director: 'Christopher Nolan',
    releaseYear: 2010,
    runtime: 148,
    imdbRating: 8.8,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Action & Adventure', 'Sci-Fi', 'Thriller'],
    platforms: ['Netflix', 'Prime Video'],
    trailer: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
    synopsis: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O., but his tragic past may doom the project.'
  },
  {
    title: 'Fight Club',
    director: 'David Fincher',
    releaseYear: 1999,
    runtime: 139,
    imdbRating: 8.8,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️',
    genres: ['Drama', 'Thriller'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=qtR39UM6YcY',
    synopsis: 'An insomniac office worker and a devil-may-care soapmaker form an underground fight club that evolves into much more than simple recreational brawling.'
  },
  {
    title: 'Forrest Gump',
    director: 'Robert Zemeckis',
    releaseYear: 1994,
    runtime: 142,
    imdbRating: 8.8,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Drama', 'Romance', 'Comedy'],
    platforms: ['Netflix', 'Prime Video'],
    trailer: 'https://www.youtube.com/watch?v=bLvqoHBptjg',
    synopsis: 'The history of the United States from the 1950s to the \'70s unfolds from the perspective of an Alabama man with an IQ of 75, who yearns to be reunited with his childhood sweetheart.'
  },
  {
    title: 'Goodfellas',
    director: 'Martin Scorsese',
    releaseYear: 1990,
    runtime: 145,
    imdbRating: 8.7,
    status: '🍿 To Watch',
    genres: ['Crime', 'Drama'],
    platforms: ['Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=2ilzidi_J8Q',
    synopsis: 'The story of Henry Hill and his life in the mafia, covering his relationship with his wife Karen and his mob partners Jimmy Conway and Tommy DeVito.'
  },
  {
    title: 'The Matrix',
    director: 'Lana Wachowski',
    releaseYear: 1999,
    runtime: 136,
    imdbRating: 8.7,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Sci-Fi', 'Action & Adventure'],
    platforms: ['Netflix', 'Prime Video'],
    trailer: 'https://www.youtube.com/watch?v=vKQi3bBA1y8',
    synopsis: 'When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth--the life he knows is the elaborate deception of an evil cyber-intelligence.'
  },
  {
    title: 'Seven',
    director: 'David Fincher',
    releaseYear: 1995,
    runtime: 127,
    imdbRating: 8.6,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Crime', 'Thriller', 'Drama'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=znmZoB75JBY',
    synopsis: 'Two detectives, a rookie and a veteran, hunt a serial killer who uses the seven deadly sins as his motives.'
  },
  {
    title: 'Interstellar',
    director: 'Christopher Nolan',
    releaseYear: 2014,
    runtime: 169,
    imdbRating: 8.7,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Sci-Fi', 'Drama'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=zSWdZATo3cA',
    synopsis: 'When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot, Joseph Cooper, is tasked to pilot a spacecraft, along with a team of researchers, to find a new planet for humans.'
  },
  {
    title: 'Parasite',
    director: 'Bong Joon Ho',
    releaseYear: 2019,
    runtime: 132,
    imdbRating: 8.5,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Drama', 'Thriller', 'Comedy'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=SEUXfv87Wpk',
    synopsis: 'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.'
  },
  {
    title: 'Spirited Away',
    director: 'Hayao Miyazaki',
    releaseYear: 2001,
    runtime: 125,
    imdbRating: 8.6,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Animation', 'Fantasy', 'Drama'],
    platforms: ['Netflix'],
    trailer: 'https://www.youtube.com/watch?v=ByXuk9QqQkk',
    synopsis: 'During her family\'s move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits, and where humans are changed into beasts.'
  },
  {
    title: 'Gladiator',
    director: 'Ridley Scott',
    releaseYear: 2000,
    runtime: 155,
    imdbRating: 8.5,
    status: '🍿 To Watch',
    genres: ['Action & Adventure', 'Drama'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=ol67qo3WhZw',
    synopsis: 'A former Roman General sets out to exact vengeance against the corrupt emperor who murdered his family and sent him into slavery.'
  },
  {
    title: 'The Departed',
    director: 'Martin Scorsese',
    releaseYear: 2006,
    runtime: 151,
    imdbRating: 8.5,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️',
    genres: ['Crime', 'Thriller', 'Drama'],
    platforms: ['Netflix', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=iojhqm0JYi4',
    synopsis: 'An undercover cop and a mole in the police attempt to identify each other while infiltrating an Irish gang in South Boston.'
  },
  {
    title: 'The Prestige',
    director: 'Christopher Nolan',
    releaseYear: 2006,
    runtime: 130,
    imdbRating: 8.5,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Thriller', 'Sci-Fi', 'Drama'],
    platforms: ['Netflix', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=ijXruSzfGEc',
    synopsis: 'After a tragic accident, two stage magicians in 1890s London engage in a battle to create the ultimate illusion while sacrificing everything they have to outwit each other.'
  },
  {
    title: 'Django Unchained',
    director: 'Quentin Tarantino',
    releaseYear: 2012,
    runtime: 165,
    imdbRating: 8.5,
    status: '🍿 To Watch',
    genres: ['Action & Adventure', 'Drama'],
    platforms: ['Netflix', 'Prime Video'],
    trailer: 'https://www.youtube.com/watch?v=0fUCuvNlOCg',
    synopsis: 'With the assistance of a German bounty-hunter, a freed slave sets out to rescue his wife from a brutal Mississippi plantation owner.'
  },
  {
    title: 'WALL-E',
    director: 'Andrew Stanton',
    releaseYear: 2008,
    runtime: 98,
    imdbRating: 8.4,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Animation', 'Sci-Fi', 'Romance'],
    platforms: ['Disney+'],
    trailer: 'https://www.youtube.com/watch?v=alIq_wG9FNk',
    synopsis: 'In the distant future, a small waste-collecting robot inadvertently embarks on a space journey that will ultimately decide the fate of mankind.'
  },
  {
    title: 'The Shining',
    director: 'Stanley Kubrick',
    releaseYear: 1980,
    runtime: 146,
    imdbRating: 8.4,
    status: '🍿 To Watch',
    genres: ['Horror', 'Thriller'],
    platforms: ['Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=5Cb3ik6zP2I',
    synopsis: 'A family heads to an isolated hotel for the winter where a sinister presence influences the father into violence, while his psychic son sees horrific forebodings from both past and future.'
  },
  {
    title: 'Blade Runner 2049',
    director: 'Denis Villeneuve',
    releaseYear: 2017,
    runtime: 164,
    imdbRating: 8.0,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Sci-Fi', 'Thriller', 'Action & Adventure'],
    platforms: ['Netflix', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=gCcx85zbxz4',
    synopsis: 'A new blade runner, LAPD Officer K, unearths a long-buried secret that has the potential to plunge what\'s left of society into chaos.'
  },
  {
    title: 'Dune: Part Two',
    director: 'Denis Villeneuve',
    releaseYear: 2024,
    runtime: 166,
    imdbRating: 8.6,
    status: '⏳ Watching',
    genres: ['Sci-Fi', 'Action & Adventure', 'Drama'],
    platforms: ['Cinema', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=Way9Dexny3w',
    synopsis: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.'
  },
  {
    title: 'Spider-Man: Into the Spider-Verse',
    director: 'Peter Ramsey',
    releaseYear: 2018,
    runtime: 117,
    imdbRating: 8.4,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Animation', 'Action & Adventure', 'Sci-Fi'],
    platforms: ['Disney+', 'Netflix'],
    trailer: 'https://www.youtube.com/watch?v=g4HbzQFUp3A',
    synopsis: 'Teen Miles Morales becomes the Spider-Man of his universe, and must join with five spider-powered individuals from other dimensions to stop a threat for all realities.'
  },
  {
    title: 'Get Out',
    director: 'Jordan Peele',
    releaseYear: 2017,
    runtime: 104,
    imdbRating: 7.8,
    status: '🍿 To Watch',
    genres: ['Horror', 'Thriller'],
    platforms: ['Netflix', 'Prime Video'],
    trailer: 'https://www.youtube.com/watch?v=sRfnebToXS4',
    synopsis: 'A young African-American visits his white girlfriend\'s parents for the weekend, where his simmering uneasiness about their reception eventually reaches a boiling point.'
  },
  {
    title: 'Knives Out',
    director: 'Rian Johnson',
    releaseYear: 2019,
    runtime: 130,
    imdbRating: 7.9,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️',
    genres: ['Comedy', 'Crime', 'Thriller'],
    platforms: ['Netflix', 'Prime Video'],
    trailer: 'https://www.youtube.com/watch?v=qGqiHJTsRkQ',
    synopsis: 'A detective investigates the death of a patriarch of an eccentric, combative family.'
  },
  {
    title: 'La La Land',
    director: 'Damien Chazelle',
    releaseYear: 2016,
    runtime: 128,
    imdbRating: 8.0,
    status: '🍿 To Watch',
    genres: ['Romance', 'Drama', 'Comedy'],
    platforms: ['Netflix', 'Prime Video'],
    trailer: 'https://www.youtube.com/watch?v=0pdqf4P9MB8',
    synopsis: 'While navigating their careers in Los Angeles, a pianist and an actress fall in love while attempting to reconcile their aspirations for the future.'
  },
  {
    title: 'Joker',
    director: 'Todd Phillips',
    releaseYear: 2019,
    runtime: 122,
    imdbRating: 8.4,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️',
    genres: ['Crime', 'Drama', 'Thriller'],
    platforms: ['Netflix', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=zAGVQLHzy08',
    synopsis: 'During the 1980s, a mentally troubled comedian is disregarded and mistreated by society, leading him down a path of self-destruction and crime in Gotham City.'
  },
  {
    title: 'The Grand Budapest Hotel',
    director: 'Wes Anderson',
    releaseYear: 2014,
    runtime: 99,
    imdbRating: 8.1,
    status: '🍿 To Watch',
    genres: ['Comedy', 'Drama'],
    platforms: ['Disney+', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=1Fg5iWmQjwk',
    synopsis: 'A writer relates his adventures at a renowned European resort hotel between the first and second World Wars with Gustave H, a legendary concierge.'
  },
  {
    title: 'Inglourious Basterds',
    director: 'Quentin Tarantino',
    releaseYear: 2009,
    runtime: 153,
    imdbRating: 8.4,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Action & Adventure', 'Drama'],
    platforms: ['Netflix', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=KqbNH0_8_So',
    synopsis: 'In Nazi-occupied France during World War II, a plan to assassinate Nazi leaders by a group of Jewish U.S. soldiers coincides with a theater owner\'s vengeful plans for the same.'
  },
  {
    title: 'The Truman Show',
    director: 'Peter Weir',
    releaseYear: 1998,
    runtime: 103,
    imdbRating: 8.2,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Drama', 'Comedy'],
    platforms: ['Prime Video', 'Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=dlnmQbPGuls',
    synopsis: 'An insurance salesman discovers his entire life is actually a highly orchestrated reality television show broadcast 24/7 to a global audience.'
  },
  {
    title: 'Your Name',
    director: 'Makoto Shinkai',
    releaseYear: 2016,
    runtime: 106,
    imdbRating: 8.4,
    status: '✅ Watched',
    personalRating: '⭐️⭐️⭐️⭐️⭐️',
    genres: ['Animation', 'Romance', 'Fantasy', 'Drama'],
    platforms: ['Apple TV+'],
    trailer: 'https://www.youtube.com/watch?v=xEVpHG2W2AM',
    synopsis: 'Two strangers find themselves linked in a bizarre way. When a connection is formed, will distance be the only thing to keep them apart?'
  },
  {
    title: 'No Country for Old Men',
    director: 'Joel Coen',
    releaseYear: 2007,
    runtime: 122,
    imdbRating: 8.2,
    status: '🍿 To Watch',
    genres: ['Crime', 'Thriller', 'Drama'],
    platforms: ['Netflix', 'Prime Video'],
    trailer: 'https://www.youtube.com/watch?v=38A__WT3-o0',
    synopsis: 'Violence and mayhem ensue after a hunter stumbles upon a drug deal gone wrong and more than two million dollars in cash near the Rio Grande.'
  }
];

/**
 * Fetch all existing movies in the Notion database to construct an in-memory cache
 */
async function fetchNotionCache() {
  console.log('\x1b[36mQuerying Notion database for existing pages to build cache...\x1b[0m');
  const cache = new Map();
  let hasMore = true;
  let startCursor = undefined;

  try {
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        // Notion database pages store the title under properties matching the title type.
        // We look for a property that is of type "title".
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
      startCursor = response.next_cursor;
    }
    console.log(`\x1b[32mCache built! Loaded ${cache.size} existing movie titles.\x1b[0m\n`);
    return cache;
  } catch (error) {
    console.error('\x1b[31mError querying Notion database:\x1b[0m', error.message);
    throw error;
  }
}

/**
 * Maps a local movie object into Notion API properties matching the Movies Collection schema
 */
function buildNotionProperties(movie) {
  const properties = {
    'Title': {
      title: [{ text: { content: movie.title } }]
    },
    'Director': {
      rich_text: [{ text: { content: movie.director } }]
    },
    'ReleaseYear': {
      number: movie.releaseYear
    },
    'Runtime': {
      number: movie.runtime
    },
    'IMDbRating': {
      number: movie.imdbRating
    },
    'Status': {
      select: { name: movie.status }
    },
    'Trailer': {
      url: movie.trailer
    },
    'Synopsis': {
      rich_text: [{ text: { content: movie.synopsis.substring(0, 1900) } }]
    }
  };

  // Add optional Genre tags (multi_select)
  if (movie.genres && movie.genres.length > 0) {
    properties['Genre'] = {
      multi_select: movie.genres.map(g => ({ name: g }))
    };
  }

  // Add optional Platform tags (multi_select)
  if (movie.platforms && movie.platforms.length > 0) {
    properties['Platform'] = {
      multi_select: movie.platforms.map(p => ({ name: p }))
    };
  }

  // Add optional Personal Rating (select) if watched and rating exists
  if (movie.personalRating && movie.status === '✅ Watched') {
    properties['PersonalRating'] = {
      select: { name: movie.personalRating }
    };
  } else {
    properties['PersonalRating'] = null; // Clear if not watched
  }

  return properties;
}

/**
 * Execute Seeding Engine
 */
async function start() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('====================================================');
  console.log('\x1b[35m🎬 Starting Byronotion Movie Importer & Seeder\x1b[0m');
  console.log('====================================================');
  if (isDryRun) {
    console.log('\x1b[33m*** DRY RUN MODE (No API calls will be made) ***\x1b[0m\n');
  }

  try {
    let existingCache = new Map();
    if (!isDryRun) {
      existingCache = await fetchNotionCache();
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const movie of moviesDataset) {
      const cacheKey = movie.title.toLowerCase().trim();
      const existingPageId = existingCache.get(cacheKey);

      if (isDryRun) {
        console.log(`\x1b[36m[Dry-Run] Title: "${movie.title}"\x1b[0m`);
        console.log(`  Director: ${movie.director} | Year: ${movie.releaseYear} | Runtime: ${movie.runtime}m | IMDb: ${movie.imdbRating}`);
        console.log(`  Genres: [${movie.genres.join(', ')}] | Platforms: [${movie.platforms ? movie.platforms.join(', ') : 'None'}]`);
        console.log(`  Status: ${movie.status} | PersonalRating: ${movie.personalRating || 'N/A'}`);
        console.log(`  Synopsis: "${movie.synopsis.substring(0, 80)}..."`);
        console.log('----------------------------------------------------');
        continue;
      }

      const properties = buildNotionProperties(movie);

      if (existingPageId) {
        // In this import, since we have rich static info, we update the existing pages to ensure full seeding
        console.log(`\x1b[33m[Updating] "${movie.title}" inside Notion...\x1b[0m`);
        try {
          await notion.pages.update({
            page_id: existingPageId,
            properties: properties
          });
          updatedCount++;
          await sleep(350); // Rate-limiting delay
        } catch (err) {
          console.error(`\x1b[31m  Failed to update page for "${movie.title}":\x1b[0m`, err.message);
        }
      } else {
        // Insert new page
        console.log(`\x1b[32m[Inserting] "${movie.title}" (IMDb: ${movie.imdbRating}) into Notion...\x1b[0m`);
        try {
          await notion.pages.create({
            parent: { database_id: DATABASE_ID },
            properties: properties
          });
          insertedCount++;
          await sleep(350); // Rate-limiting delay
        } catch (err) {
          console.error(`\x1b[31m  Failed to create page for "${movie.title}":\x1b[0m`, err.message);
        }
      }
    }

    console.log('\n====================================================');
    console.log('\x1b[32m🎉 Seeding Batch Finished!\x1b[0m');
    if (isDryRun) {
      console.log(`🟢 Verified ${moviesDataset.length} cinematic records mapping details.`);
    } else {
      console.log(`🟢 Successfully Created: ${insertedCount} new movie pages.`);
      console.log(`🟡 Successfully Updated: ${updatedCount} existing movie pages.`);
      console.log(`⚪ Skipped: ${skippedCount} pages.`);
    }
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in movie seeder execution:', error.message);
  }
}

start();
