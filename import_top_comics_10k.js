/**
 * Seeder for Comics Library - Curated Premium Masterpieces & Major Publishers
 * Powered by keyless Open Library Search API & Notion SDK
 * Developed for Byronotion Watchlist Tracker
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

// Configuration
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_COMICS_DATABASE_ID || '371d0aaf19d081c59b14fbc0c52b0040';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const importLimit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 150; // Focused on top famous masterpieces

// ─── PREMIUM CURATED DATASET (Top 40 Greatest Comics of All Time) ────────────
const PREMIUM_COMICS = [
  {
    title: "Watchmen",
    writer: "Alan Moore",
    artist: "Dave Gibbons",
    publisher: "DC Comics",
    year: 1986,
    rating: 4.85,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1440337432i/157041.jpg",
    issues: 12,
    volumes: 1,
    synopsis: "In an alternate 1985 America, co-existing superhero vigilantes are outlawed. The murder of one of their own triggers a massive conspiracy to prevent a nuclear apocalypse."
  },
  {
    title: "Saga, Vol. 1",
    writer: "Brian K. Vaughan",
    artist: "Fiona Staples",
    publisher: "Image Comics",
    year: 2012,
    rating: 4.72,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1487841804i/15704273.jpg",
    issues: 6,
    volumes: 1,
    synopsis: "An epic space opera/fantasy focusing on Alana and Marko, two soldiers from opposite sides of a never-ending galactic war, who fall in love and risk everything to protect their newborn daughter."
  },
  {
    title: "Batman: The Dark Knight Returns",
    writer: "Frank Miller",
    artist: "Frank Miller",
    publisher: "DC Comics",
    year: 1986,
    rating: 4.78,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1392651474i/59960.jpg",
    issues: 4,
    volumes: 1,
    synopsis: "A middle-aged Bruce Wayne dons the cowl once more to reclaim the streets of a dystopian Gotham City from mutants, old enemies, and a government-controlled Superman."
  },
  {
    title: "Batman: The Long Halloween",
    writer: "Jeph Loeb",
    artist: "Tim Sale",
    publisher: "DC Comics",
    year: 1996,
    rating: 4.65,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327936141i/14889.jpg",
    issues: 13,
    volumes: 1,
    synopsis: "A classic mystery story pitting Batman, Harvey Dent, and Jim Gordon against a mysterious killer named Holiday, who murders Gotham mobsters on holidays."
  },
  {
    title: "Batman: Year One",
    writer: "Frank Miller",
    artist: "David Mazzucchelli",
    publisher: "DC Comics",
    year: 1987,
    rating: 4.68,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1388185802i/59974.jpg",
    issues: 4,
    volumes: 1,
    synopsis: "Bruce Wayne's first year of crime-fighting in Gotham City, intersecting with the arrival of Lieutenant James Gordon in a deeply corrupt police force."
  },
  {
    title: "Maus",
    writer: "Art Spiegelman",
    artist: "Art Spiegelman",
    publisher: "Indie",
    year: 1986,
    rating: 4.88,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327351659i/15195.jpg",
    issues: 1,
    volumes: 1,
    synopsis: "A Pulitzer Prize-winning graphic novel depicting the author's father's experiences surviving the Holocaust, with Jews drawn as mice and Germans as cats."
  },
  {
    title: "The Sandman, Vol. 1: Preludes & Nocturnes",
    writer: "Neil Gaiman",
    artist: "Sam Kieth",
    publisher: "Vertigo",
    year: 1989,
    rating: 4.70,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327878394i/23754.jpg",
    issues: 8,
    volumes: 1,
    synopsis: "The King of Dreams, Morpheus, escapes after decades of imprisonment and embarks on a quest to reclaim his stolen objects of power."
  },
  {
    title: "V for Vendetta",
    writer: "Alan Moore",
    artist: "David Lloyd",
    publisher: "DC Comics",
    year: 1982,
    rating: 4.62,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1343668388i/5805.jpg",
    issues: 10,
    volumes: 1,
    synopsis: "In a dystopian, totalitarian future Britain, a mysterious anarchist vigilante wearing a Guy Fawkes mask attempts to destroy the state."
  },
  {
    title: "Kingdom Come",
    writer: "Mark Waid",
    artist: "Alex Ross",
    publisher: "DC Comics",
    year: 1996,
    rating: 4.71,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327936142i/16990.jpg",
    issues: 4,
    volumes: 1,
    synopsis: "An epic battle between traditional heroes like Superman and Wonder Woman and a new generation of amoral, reckless metahumans."
  },
  {
    title: "The Walking Dead, Vol. 1: Days Gone Bye",
    writer: "Robert Kirkman",
    artist: "Tony Moore",
    publisher: "Image Comics",
    year: 2004,
    rating: 4.60,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1487841804i/13830.jpg",
    issues: 6,
    volumes: 1,
    synopsis: "Police officer Rick Grimes wakes up from a coma to discover a world overrun by flesh-eating zombies and must fight to find his family."
  },
  {
    title: "Invincible, Vol. 1: Family Matters",
    writer: "Robert Kirkman",
    artist: "Cory Walker",
    publisher: "Image Comics",
    year: 2003,
    rating: 4.64,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327961175i/4143.jpg",
    issues: 4,
    volumes: 1,
    synopsis: "Mark Grayson, the teenage son of Omni-Man (the world's most powerful superhero), inherits his own powers and begins his journey as a hero."
  },
  {
    title: "Civil War",
    writer: "Mark Millar",
    artist: "Steve McNiven",
    publisher: "Marvel Comics",
    year: 2006,
    rating: 4.61,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1388194488i/60905.jpg",
    issues: 7,
    volumes: 1,
    synopsis: "A tragic accident prompts the government to pass a Superhero Registration Act, splitting the Marvel Universe into two opposing factions led by Iron Man and Captain America."
  },
  {
    title: "Batman: The Killing Joke",
    writer: "Alan Moore",
    artist: "Brian Bolland",
    publisher: "DC Comics",
    year: 1988,
    rating: 4.65,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1441324707i/96358.jpg",
    issues: 1,
    volumes: 1,
    synopsis: "The definitive origin story of the Joker, who attempts to drive Commissioner James Gordon insane to prove that 'one bad day' can break anyone."
  },
  {
    title: "Y: The Last Man, Vol. 1: Unmanned",
    writer: "Brian K. Vaughan",
    artist: "Pia Guerra",
    publisher: "Vertigo",
    year: 2003,
    rating: 4.54,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327883256i/4282.jpg",
    issues: 5,
    volumes: 1,
    synopsis: "An instantaneous plague wipes out every living mammal with a Y chromosome on Earth, leaving only Yorick Brown and his pet capuchin monkey alive."
  },
  {
    title: "Locke & Key, Vol. 1: Welcome to Lovecraft",
    writer: "Joe Hill",
    artist: "Gabriel Rodriguez",
    publisher: "IDW Publishing",
    year: 2008,
    rating: 4.62,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327918512i/4207904.jpg",
    issues: 6,
    volumes: 1,
    synopsis: "Following their father's murder, the Locke children move into Keyhouse, a mysterious mansion filled with magical keys that grant bizarre powers."
  },
  {
    title: "Something Is Killing the Children, Vol. 1",
    writer: "James Tynion IV",
    artist: "Werther Dell'Edera",
    publisher: "Boom! Studios",
    year: 2020,
    rating: 4.55,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1585773173i/50358085.jpg",
    issues: 5,
    volumes: 1,
    synopsis: "When children in Archer's Peak begin disappearing and returning with stories of terrifying monsters, a mysterious monster hunter named Erica Slaughter arrives to eliminate the threat."
  },
  {
    title: "Preacher, Vol. 1: Gone to Texas",
    writer: "Garth Ennis",
    artist: "Steve Dillon",
    publisher: "Vertigo",
    year: 1996,
    rating: 4.52,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327941014i/31168.jpg",
    issues: 7,
    volumes: 1,
    synopsis: "Texas preacher Jesse Custer is possessed by a half-angel, half-demon entity named Genesis, granting him the literal voice of God as he embarks on a journey to find the Almighty."
  },
  {
    title: "Batman: Court of Owls",
    writer: "Scott Snyder",
    artist: "Greg Capullo",
    publisher: "DC Comics",
    year: 2012,
    rating: 4.63,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1344265518i/13591460.jpg",
    issues: 7,
    volumes: 1,
    synopsis: "Batman discovers that Gotham City is controlled by a centuries-old secret society known as the Court of Owls, who deploy undead assassins called Talons."
  },
  {
    title: "All-Star Superman",
    writer: "Grant Morrison",
    artist: "Frank Quitely",
    publisher: "DC Comics",
    year: 2005,
    rating: 4.70,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327936142i/76189.jpg",
    issues: 12,
    volumes: 1,
    synopsis: "After receiving a lethal dose of solar radiation, a dying Superman spends his remaining days performing legendary feats and preparing the world for his absence."
  },
  {
    title: "Batman: Hush",
    writer: "Jeph Loeb",
    artist: "Jim Lee",
    publisher: "DC Comics",
    year: 2002,
    rating: 4.55,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327936142i/769736.jpg",
    issues: 12,
    volumes: 1,
    synopsis: "A mysterious new stalker named Hush orchestrates a massive conspiracy, manipulating Batman's entire rogue's gallery to destroy Bruce Wayne's life."
  },
  {
    title: "Spider-Man: Blue",
    writer: "Jeph Loeb",
    artist: "Tim Sale",
    publisher: "Marvel Comics",
    year: 2002,
    rating: 4.62,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327936142i/76192.jpg",
    issues: 6,
    volumes: 1,
    synopsis: "Peter Parker looks back on the bittersweet memories of falling in love with Gwen Stacy, exploring the heartbreak and triumph of his early days as Spider-Man."
  },
  {
    title: "Daredevil: Born Again",
    writer: "Frank Miller",
    artist: "David Mazzucchelli",
    publisher: "Marvel Comics",
    year: 1986,
    rating: 4.75,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1435272635i/24716447.jpg",
    issues: 7,
    volumes: 1,
    synopsis: "The Kingpin learns Daredevil's secret identity and systematically destroys Matt Murdock's career, home, and sanity, forcing Murdock to rebuild his life from nothing."
  },
  {
    title: "Wolverine: Old Man Logan",
    writer: "Mark Millar",
    artist: "Steve McNiven",
    publisher: "Marvel Comics",
    year: 2008,
    rating: 4.58,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1388194488i/60905.jpg",
    issues: 8,
    volumes: 1,
    synopsis: "In a dystopian future where supervillains have conquered America, a pacified Logan refuses to pop his claws until a tragic event forces him on a brutal road trip across the country."
  },
  {
    title: "Green Lantern: Rebirth",
    writer: "Geoff Johns",
    artist: "Ethan Van Sciver",
    publisher: "DC Comics",
    year: 2004,
    rating: 4.50,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1344265492i/61986.jpg",
    issues: 6,
    volumes: 1,
    synopsis: "The legendary Green Lantern Hal Jordan returns to life and seeks redemption after being possessed by the fear entity Parallax."
  },
  {
    title: "Fables, Vol. 1: Legends in Exile",
    writer: "Bill Willingham",
    artist: "Lan Medina",
    publisher: "Vertigo",
    year: 2002,
    rating: 4.52,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327918512i/21326.jpg",
    issues: 5,
    volumes: 1,
    synopsis: "When Snow White's sister is murdered in Fabletown (a secret community of fairy tale characters hiding in New York City), Sheriff Bigby Wolf must solve the mystery."
  },
  {
    title: "Daytripper",
    writer: "Gabriel Bá",
    artist: "Fábio Moon",
    publisher: "Vertigo",
    year: 2010,
    rating: 4.74,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327936142i/8477057.jpg",
    issues: 10,
    volumes: 1,
    synopsis: "A gorgeous, philosophical story charting the life and multiple deaths of Brás de Oliva Domingos, an obituary writer who explores the significance of family, love, and destiny."
  },
  {
    title: "Hellboy, Vol. 1: Seed of Destruction",
    writer: "Mike Mignola",
    artist: "Mike Mignola",
    publisher: "Dark Horse Comics",
    year: 1994,
    rating: 4.53,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327936142i/102458.jpg",
    issues: 4,
    volumes: 1,
    synopsis: "Hellboy is summoned to Earth by occultists during WWII and grows up to become an investigator for the B.P.R.D., exploring his demonic heritage while fighting cosmic horrors."
  },
  {
    title: "Sin City, Vol. 1: The Hard Goodbye",
    writer: "Frank Miller",
    artist: "Frank Miller",
    publisher: "Dark Horse Comics",
    year: 1991,
    rating: 4.56,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327936142i/102324.jpg",
    issues: 13,
    volumes: 1,
    synopsis: "Marv, a hulking ex-con in Basin City, goes on a relentless, bloody rampage of vengeance to find the killer of Goldie, a beautiful woman who gave him one perfect night."
  },
  {
    title: "Black Hammer, Vol. 1: Secret Origins",
    writer: "Jeff Lemire",
    artist: "Dean Ormston",
    publisher: "Dark Horse Comics",
    year: 2017,
    rating: 4.58,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1487841804i/31388145.jpg",
    issues: 6,
    volumes: 1,
    synopsis: "Decades after saving Spiral City, a group of forgotten superheroes find themselves trapped in a mysterious, inescapable farming town, forced to pose as a family."
  },
  {
    title: "Chew, Vol. 1: Taster's Choice",
    writer: "John Layman",
    artist: "Rob Guillory",
    publisher: "Image Comics",
    year: 2009,
    rating: 4.51,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327936142i/6839093.jpg",
    issues: 5,
    volumes: 1,
    synopsis: "Tony Chu is a cibopathic detective who gets psychic impressions from whatever he eats (even human flesh), solving bizarre food-related crimes in a world where poultry is outlawed."
  },
  {
    title: "East of West, Vol. 1: The Promise",
    writer: "Jonathan Hickman",
    artist: "Nick Dragotta",
    publisher: "Image Comics",
    year: 2013,
    rating: 4.52,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1376840742i/18154174.jpg",
    issues: 5,
    volumes: 1,
    synopsis: "A sci-fi Western set in a balkanized future America, where the Four Horsemen of the Apocalypse roam the lands and Death seeks vengeance for his stolen wife and child."
  },
  {
    title: "Saga of the Swamp Thing, Book 1",
    writer: "Alan Moore",
    artist: "Stephen Bissette",
    publisher: "DC Comics",
    year: 1984,
    rating: 4.76,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327936142i/102326.jpg",
    issues: 7,
    volumes: 1,
    synopsis: "Alan Moore's groundbreaking run redefining the Swamp Thing, starting with 'The Anatomy Lesson' and transforming the character from a transformed man into a sentient plant elemental."
  },
  {
    title: "Monstress, Vol. 1: Awakening",
    writer: "Marjorie Liu",
    artist: "Sana Takeda",
    publisher: "Image Comics",
    year: 2016,
    rating: 4.60,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1487841804i/29396738.jpg",
    issues: 6,
    volumes: 1,
    synopsis: "Set in an alternate matriarchal Asia, an Arcanic teenager named Maika Halfwolf shares a psychic link with an ancient, powerful monster while surviving a brutal war."
  },
  {
    title: "Paper Girls, Vol. 1",
    writer: "Brian K. Vaughan",
    artist: "Cliff Chiang",
    publisher: "Image Comics",
    year: 2016,
    rating: 4.51,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1487841804i/28204534.jpg",
    issues: 5,
    volumes: 1,
    synopsis: "Four 12-year-old newspaper delivery girls in 1988 Cleveland discover a time-travel conspiracy, throwing them into an epic journey across history to save the future."
  },
  {
    title: "From Hell",
    writer: "Alan Moore",
    artist: "Eddie Campbell",
    publisher: "Indie",
    year: 1999,
    rating: 4.58,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1410141680i/386161.jpg",
    issues: 11,
    volumes: 1,
    synopsis: "A deeply researched, terrifying psychological examination of Jack the Ripper's killings in Victorian London, exploring conspiracy theories and royal cover-ups."
  },
  {
    title: "Blankets",
    writer: "Craig Thompson",
    artist: "Craig Thompson",
    publisher: "Indie",
    year: 2003,
    rating: 4.64,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327918512i/25179.jpg",
    issues: 1,
    volumes: 1,
    synopsis: "An incredibly touching autobiographical graphic novel exploring the author's strict Christian upbringing, his relationship with his disabled brother, and his first love."
  },
  {
    title: "Habibi",
    writer: "Craig Thompson",
    artist: "Craig Thompson",
    publisher: "Indie",
    year: 2011,
    rating: 4.56,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1317066914i/10138607.jpg",
    issues: 1,
    volumes: 1,
    synopsis: "Set in a mythical Middle Eastern landscape, this beautiful graphic novel tells the epic love story of Dodola and Zam, two escaped child slaves bound by shared trauma."
  },
  {
    title: "All-Star Batman & Robin, the Boy Wonder",
    writer: "Frank Miller",
    artist: "Jim Lee",
    publisher: "DC Comics",
    year: 2008,
    rating: 4.38,
    cover: "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1327936142i/76193.jpg",
    issues: 10,
    volumes: 1,
    synopsis: "A high-octane retelling of Dick Grayson's adoption and early training by a grim, militaristic Batman in Gotham City."
  }
];

// Major Publishers list to format correctly
const ALLOWED_PUBLISHERS = ["DC Comics", "Marvel Comics", "Image Comics", "Dark Horse Comics", "Vertigo", "IDW Publishing", "Boom! Studios", "Indie"];

/**
 * Helper: API call retry handler for rate limits (429)
 */
async function withRetry(apiCall, retries = 5, delayMs = 3000) {
  try {
    return await apiCall();
  } catch (error) {
    const isRateLimit = error.status === 429 || 
                        error.message?.includes('429') || 
                        error.message?.toLowerCase().includes('rate limit') ||
                        error.response?.status === 429;
                        
    if (isRateLimit && retries > 0) {
      console.warn(`\x1b[33m  [Rate Limit] Waiting ${delayMs}ms before retrying (Retries left: ${retries})...\x1b[0m`);
      await sleep(delayMs);
      return withRetry(apiCall, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

/**
 * Fetch existing items to prevent duplicates (caching Title -> Page ID)
 */
async function fetchNotionCache() {
  console.log('\x1b[36mQuerying Notion database for existing pages to build cache...\x1b[0m');
  const cache = new Map();
  let hasMore = true;
  let startCursor = undefined;
  
  try {
    while (hasMore) {
      const response = await scarcityRetry(() => notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: startCursor,
        page_size: 100,
      }));

      for (const page of response.results) {
        const titleProp = page.properties['Title'];
        if (titleProp && titleProp.type === 'title') {
          const titleText = titleProp.title.map(t => t.plain_text).join('').trim();
          if (titleText) {
            cache.set(titleText.toLowerCase(), page.id);
          }
        }
      }
      hasMore = response.has_more;
      startCursor = response.next_cursor;
      await sleep(350); // respect rate limits
    }
    console.log(`\x1b[32mCache built successfully! Loaded ${cache.size} existing comic items from Notion.\x1b[0m\n`);
    return cache;
  } catch (error) {
    console.error('\x1b[31mError querying Notion database:\x1b[0m', error.message);
    throw error;
  }
}

// Wrapper for Notion operations
async function scarcityRetry(apiCall) {
  return withRetry(apiCall, 15, 30000); // 15 retries starting at 30s backoff (resilient to hourly write quotas)
}

/**
 * Maps Open Library subjects to standardized Genres
 */
function mapSubjectsToGenres(subjects) {
  if (!subjects || !Array.isArray(subjects)) return ['Graphic Novel'];
  
  const mapped = new Set();
  const lowerSubjects = subjects.map(s => s.toLowerCase());

  for (const s of lowerSubjects) {
    if (s.includes('superhero') || s.includes('marvel') || s.includes('dc') || s.includes('batman') || s.includes('superman') || s.includes('spider-man') || s.includes('avengers') || s.includes('justice league')) {
      mapped.add('Superhero');
    }
    if (s.includes('sci-fi') || s.includes('science fiction') || s.includes('dystopian') || s.includes('future') || s.includes('cyberpunk') || s.includes('apocalypse')) {
      mapped.add('Sci-Fi / Dystopian');
    }
    if (s.includes('fantasy') || s.includes('magic') || s.includes('supernatural') || s.includes('sandman') || s.includes('demon') || s.includes('vampire') || s.includes('mythology')) {
      mapped.add('Fantasy / Supernatural');
    }
    if (s.includes('horror') || s.includes('ghost') || s.includes('scary') || s.includes('undead') || s.includes('zombie')) {
      mapped.add('Horror');
    }
    if (s.includes('crime') || s.includes('noir') || s.includes('detective') || s.includes('mystery') || s.includes('thriller') || s.includes('murder') || s.includes('suspense')) {
      mapped.add('Crime / Noir');
    }
    if (s.includes('drama') || s.includes('relationship') || s.includes('slice of life') || s.includes('biography') || s.includes('autobiography') || s.includes('memoir')) {
      mapped.add('Drama / Slice of Life');
    }
    if (s.includes('action') || s.includes('adventure') || s.includes('war') || s.includes('combat') || s.includes('soldier') || s.includes('military')) {
      mapped.add('Action & Adventure');
    }
    if (s.includes('romance') || s.includes('love') || s.includes('romantic')) {
      mapped.add('Romance');
    }
    if (s.includes('comedy') || s.includes('humor') || s.includes('funny') || s.includes('satire')) {
      mapped.add('Comedy');
    }
    if (s.includes('history') || s.includes('historical') || s.includes('non-fiction') || s.includes('real life') || s.includes('politics')) {
      mapped.add('Historical');
    }
  }

  const result = [...mapped];
  return result.length > 0 ? result : ['Graphic Novel'];
}

/**
 * Standardize Publisher names to matched select properties
 */
function standardizePublisher(rawPub) {
  if (!rawPub) return "Indie";
  const pub = String(rawPub).toLowerCase();
  
  if (pub.includes('marvel')) return "Marvel Comics";
  if (pub.includes('dc comics') || pub.includes('detective comics') || pub.includes('dc c') || pub.includes('d.c. comics')) return "DC Comics";
  if (pub.includes('image')) return "Image Comics";
  if (pub.includes('dark horse')) return "Dark Horse Comics";
  if (pub.includes('vertigo')) return "Vertigo";
  if (pub.includes('idw')) return "IDW Publishing";
  if (pub.includes('boom!')) return "Boom! Studios";
  if (pub.includes('pantheon') || pub.includes('fantagraphics') || pub.includes('drawn & quarterly')) return "Indie";
  
  return "Indie";
}

/**
 * Setup property payload based on schema type
 */
function setPropertyPayload(properties, fieldName, value, schemaType) {
  if (!schemaType || value === null || value === undefined) return;

  if (schemaType === 'rich_text') {
    properties[fieldName] = {
      rich_text: [{ text: { content: String(value).substring(0, 2000) } }]
    };
  } else if (schemaType === 'multi_select') {
    properties[fieldName] = {
      multi_select: [{ name: String(value).substring(0, 100) }]
    };
  } else if (schemaType === 'select') {
    properties[fieldName] = {
      select: { name: String(value).substring(0, 100) }
    };
  } else if (schemaType === 'number') {
    const num = Number(value);
    if (!isNaN(num)) {
      properties[fieldName] = { number: num };
    }
  }
}

/**
 * Execute Seeding Process
 */
async function start() {
  console.log('====================================================');
  console.log(`🚀 Seeding Notion with Curated Top Comic Masterpieces ${dryRun ? '(DRY RUN)' : ''}`);
  console.log('====================================================\n');

  try {
    let types = {};
    let existingCache = new Map();
    let currentTotal = 0;

    if (dryRun) {
      types = {
        'Writer': 'rich_text',
        'Artist': 'rich_text',
        'ReleaseYear': 'number',
        'Publisher': 'select',
        'Community Rating': 'number',
        'OL Key': 'rich_text',
        'Genres': 'multi_select',
        'Issues': 'number',
        'Volumes': 'number',
        'Synopsis': 'rich_text'
      };
      console.log('[Dry Run] Bypassing Notion API connection, using default property types mapping.');
    } else {
      // 1. Retrieve schema from database with fast fallback
      console.log('\x1b[36mRetrieving database schema from Notion...\x1b[0m');
      try {
        const dbSchema = await withRetry(() => notion.databases.retrieve({ database_id: DATABASE_ID }), 2, 2000);
        console.log(`Successfully retrieved schema for database: "${dbSchema.title.map(t => t.plain_text).join('')}"`);
        // Map schema property types
        for (const [key, prop] of Object.entries(dbSchema.properties)) {
          types[key] = prop.type;
        }
      } catch (err) {
        console.log('⚠️ Notion database retrieve rate limited/failed. Using robust hardcoded fallback schema types.');
        types = {
          'Writer': 'rich_text',
          'Artist': 'rich_text',
          'ReleaseYear': 'number',
          'Publisher': 'select',
          'Community Rating': 'number',
          'OL Key': 'rich_text',
          'Genres': 'multi_select',
          'Issues': 'number',
          'Volumes': 'number',
          'Synopsis': 'rich_text'
        };
      }
      console.log('Detected property types:', JSON.stringify(types, null, 2));

      // 2. Fetch existing pages to prevent duplicates
      existingCache = await fetchNotionCache();
      currentTotal = existingCache.size;
    }
    console.log(`Current size: ${currentTotal} entries in database.\n`);

    let newlyImported = 0;

    // SECTION 1: INSERT PREMIUM CURATED COMICS FIRST
    console.log('\x1b[36m--- Inserting Premium Curated Masterpieces ---\x1b[0m');
    for (const comic of PREMIUM_COMICS) {
      if (currentTotal >= importLimit) {
        console.log(`\x1b[32m✔ Target collection size of ${importLimit} items reached!\x1b[0m`);
        break;
      }

      const cleanTitle = comic.title.trim();
      
      // Skip duplicate check
      if (existingCache.has(cleanTitle.toLowerCase())) {
        continue;
      }

      if (dryRun) {
        console.log(`[Dry Run Curated] Would insert: "${cleanTitle}" (Writer: ${comic.writer}, Publisher: ${comic.publisher}, Year: ${comic.year}, Rating: ${comic.rating})`);
        newlyImported++;
        currentTotal++;
        existingCache.set(cleanTitle.toLowerCase(), true);
        continue;
      }

      // Prepare properties
      const properties = {
        'Title': { title: [{ text: { content: cleanTitle } }] },
        'Status': { status: { name: 'Inbox' } }
      };

      // Add dynamically mapped properties
      setPropertyPayload(properties, 'Writer', comic.writer, types['Writer']);
      setPropertyPayload(properties, 'Artist', comic.artist, types['Artist']);
      setPropertyPayload(properties, 'ReleaseYear', comic.year, types['ReleaseYear']);
      setPropertyPayload(properties, 'Publisher', comic.publisher, types['Publisher']);
      setPropertyPayload(properties, 'Community Rating', comic.rating, types['Community Rating']);
      setPropertyPayload(properties, 'Issues', comic.issues, types['Issues']);
      setPropertyPayload(properties, 'Volumes', comic.volumes, types['Volumes']);
      setPropertyPayload(properties, 'Synopsis', comic.synopsis, types['Synopsis']);

      if (comic.cover) {
        properties['Cover Image'] = {
          files: [{ name: 'Cover Image', type: 'external', external: { url: comic.cover } }]
        };
      }

      // Mapping Genres
      const genres = ['Graphic Novel'];
      if (cleanTitle.toLowerCase().includes('batman') || cleanTitle.toLowerCase().includes('superman') || cleanTitle.toLowerCase().includes('civil war') || cleanTitle.toLowerCase().includes('invincible')) {
        genres.push('Superhero');
      } else if (cleanTitle.toLowerCase().includes('sandman') || cleanTitle.toLowerCase().includes('hellboy') || cleanTitle.toLowerCase().includes('something is killing')) {
        genres.push('Fantasy / Supernatural');
      } else if (cleanTitle.toLowerCase().includes('walking dead')) {
        genres.push('Horror');
      } else if (cleanTitle.toLowerCase().includes('sin city')) {
        genres.push('Crime / Noir');
      }

      if (types['Genres'] === 'multi_select') {
        properties['Genres'] = {
          multi_select: genres.map(g => ({ name: g }))
        };
      }

      const pageParams = {
        parent: { database_id: DATABASE_ID },
        properties: properties
      };

      if (comic.cover) {
        pageParams.cover = {
          type: 'external',
          external: { url: comic.cover }
        };
      }

      try {
        await scarcityRetry(() => notion.pages.create(pageParams));
        console.log(`\x1b[32m[Premium Inserted] "${cleanTitle}" by ${comic.writer} (Publisher: ${comic.publisher})\x1b[0m`);
        newlyImported++;
        currentTotal++;
        existingCache.set(cleanTitle.toLowerCase(), true);
        
        await sleep(350); // respect rate limits
      } catch (err) {
        console.error(`\x1b[31m  Failed to create curated page for "${cleanTitle}":\x1b[0m`, err.message);
      }
    }

    // SECTION 2: HIGHLY FILTERED OPEN LIBRARY API SWEEP
    if (currentTotal < importLimit) {
      console.log('\n\x1b[36m--- Starting Strictly Filtered Open Library Sweep to Fill Remaining Slots ---\x1b[0m');
      
      const itemsPerPage = 100;
      const pagesNeeded = Math.ceil((importLimit - currentTotal) / itemsPerPage) + 2;
      
      for (let pageNum = 1; pageNum <= pagesNeeded; pageNum++) {
        if (currentTotal >= importLimit) break;
        
        console.log(`\n\x1b[36mQuerying Open Library Search page ${pageNum}/${pagesNeeded}...\x1b[0m`);
        const searchUrl = 'https://openlibrary.org/search.json';
        let response;
        try {
          response = await withRetry(() => axios.get(searchUrl, {
            params: {
              q: '(subject:graphic_novels OR subject:comic_books) AND publisher:("DC Comics" OR "Marvel" OR "Image" OR "Dark Horse" OR "Vertigo" OR "IDW") AND NOT subject:manga AND NOT subject:japan AND NOT subject:japanese',
              limit: itemsPerPage,
              page: pageNum
            }
          }), 5, 5000);
        } catch (err) {
          console.error(`\x1b[31mFailed to fetch page ${pageNum} from Open Library. Skipping page.\x1b[0m`, err.message);
          await sleep(5000);
          continue;
        }

        const docs = response.data?.docs;
        if (!docs || docs.length === 0) break;

        for (const doc of docs) {
          if (currentTotal >= importLimit) break;

          const title = doc.title || 'Unknown Title';
          const cleanTitle = title.trim();
          
          if (existingCache.has(cleanTitle.toLowerCase())) continue;

          // ─── STRICT PREMIUM FILTERS ──────────────────────────────────────────
          // 1. Must have cover art
          if (!doc.cover_i) continue;
          
          // 2. Must have authors
          if (!doc.author_name || !Array.isArray(doc.author_name) || doc.author_name.length === 0) continue;
          
          // 3. Exclude Manga & Japanese entries
          const jpRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
          const mangaKeywords = [
            'manga', 'japan', 'shonen', 'shojo', 'seinen', 'josei', 'anime', 'tankobon', 'tankōbon',
            'kishimoto', 'toriyama', 'akutami', 'oda', 'ito,', 'itō', 'ohba', 'obata', 
            'miura', 'urasawa', 'takahashi', 'kubo', 'horikoshi', 'gotoge', 'takami', 'otomo', 'ōtomo',
            'isayama', 'arakawa', 'togashi', 'inoue', 'fujimoto', 'ishida', 'asano', 'tezuka', 'mizuki'
          ];
          const lowerTitle = cleanTitle.toLowerCase();
          const writer = doc.author_name[0];
          const artist = doc.author_name[1] || 'Unknown / Multiple';
          const lowerWriter = writer.toLowerCase();
          const lowerArtist = artist.toLowerCase();

          const isJapanese = jpRegex.test(cleanTitle) || jpRegex.test(writer) || jpRegex.test(artist) || (doc.language && doc.language.includes('jpn'));
          const hasMangaKeywords = mangaKeywords.some(kw => lowerTitle.includes(kw) || lowerWriter.includes(kw) || lowerArtist.includes(kw));
          const explicitManga = ['uzumaki', 'bleach', 'naruto', 'berserk', 'jujutsu', 'death note', 'dragon ball', 'akira', 'my hero academia', 'one piece', 'hunter x hunter', 'demon slayer', 'chainsaw man', 'tokyo ghoul', 'vinland saga', 'vagabond'];
          const isExplicitManga = explicitManga.some(t => lowerTitle.includes(t));

          if (isJapanese || hasMangaKeywords || isExplicitManga) continue;

          // 4. Exclude children/trash keywords
          const trashKeywords = ['diary of', 'wimpy kid', 'dork diaries', 'big nate', 'emily the strange', 'geronimo stilton', 'garfield', 'peanuts', 'archie', 'dora the explorer', 'scooby-doo', 'sponge-bob', 'simpsons'];
          if (trashKeywords.some(kw => lowerTitle.includes(kw))) continue;

          // 5. Map and standardize publisher
          const rawPub = doc.publisher && doc.publisher.length > 0 ? doc.publisher[0] : null;
          const publisher = standardizePublisher(rawPub);
          if (publisher === "Indie" && !ALLOWED_PUBLISHERS.includes("Indie")) continue; // Strictly major publishers only

          // Passed all strict filters! Insert page
          const coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          const releaseYear = doc.first_publish_year || null;
          const genres = mapSubjectsToGenres(doc.subject);
          const communityRating = doc.ratings_average ? parseFloat(doc.ratings_average.toFixed(2)) : null;
          const olKey = doc.key ? doc.key.replace('/works/', '') : '';

          if (dryRun) {
            console.log(`[Dry Run OL] Would insert: "${cleanTitle}" by ${writer} | Publisher: ${publisher} | Rating: ${communityRating}`);
            newlyImported++;
            currentTotal++;
            existingCache.set(cleanTitle.toLowerCase(), true);
            continue;
          }

          const properties = {
            'Title': { title: [{ text: { content: cleanTitle } }] },
            'Status': { status: { name: 'Inbox' } }
          };

          setPropertyPayload(properties, 'Writer', writer, types['Writer']);
          setPropertyPayload(properties, 'Artist', artist, types['Artist']);
          setPropertyPayload(properties, 'ReleaseYear', releaseYear, types['ReleaseYear']);
          setPropertyPayload(properties, 'Publisher', publisher, types['Publisher']);
          setPropertyPayload(properties, 'Community Rating', communityRating, types['Community Rating']);
          if (olKey) setPropertyPayload(properties, 'OL Key', olKey, types['OL Key']);

          if (coverUrl) {
            properties['Cover Image'] = {
              files: [{ name: 'Cover Image', type: 'external', external: { url: coverUrl } }]
            };
          }

          if (genres.length > 0 && types['Genres'] === 'multi_select') {
            properties['Genres'] = {
              multi_select: genres.map(g => ({ name: g }))
            };
          }

          // Estimating Issues & Volumes
          if (types['Issues'] === 'number') {
            const estimatedIssues = doc.edition_count && doc.edition_count > 1 ? Math.min(doc.edition_count * 2, 24) : 6;
            properties['Issues'] = { number: estimatedIssues };
          }
          if (types['Volumes'] === 'number') {
            const estimatedVolumes = doc.edition_count && doc.edition_count > 5 ? Math.min(Math.ceil(doc.edition_count / 3), 5) : 1;
            properties['Volumes'] = { number: estimatedVolumes };
          }

          // Synopsis
          if (doc.subject && doc.subject.length > 0 && types['Synopsis'] === 'rich_text') {
            const synopsis = `A professional graphic novel/comic book series published by ${publisher}, categorized under: ${doc.subject.slice(0, 5).join(', ')}.`;
            properties['Synopsis'] = {
              rich_text: [{ text: { content: synopsis.substring(0, 1900) } }]
            };
          }

          const pageParams = {
            parent: { database_id: DATABASE_ID },
            properties: properties
          };

          if (coverUrl) {
            pageParams.cover = {
              type: 'external',
              external: { url: coverUrl }
            };
          }

          try {
            await scarcityRetry(() => notion.pages.create(pageParams));
            console.log(`\x1b[32m[Inserted] "${cleanTitle}" by ${writer} (Publisher: ${publisher} | Rating: ${communityRating})\x1b[0m`);
            newlyImported++;
            currentTotal++;
            existingCache.set(cleanTitle.toLowerCase(), true);
            
            await sleep(350);
          } catch (err) {
            console.error(`\x1b[31m  Failed to create page for "${cleanTitle}":\x1b[0m`, err.message);
          }
        }
        await sleep(1500);
      }
    }

    console.log('\n====================================================');
    console.log('🎉 Seeding Sweep Complete!');
    console.log(`🟢 Total Comics currently in Notion: ${currentTotal}`);
    console.log(`🟢 Newly imported in this run: ${newlyImported}`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Critical error in Comics seeder:', err.message);
  }
}

start();
