const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_TV_DATABASE_ID || '36dd0aaf19d08123893fcbaf9bff624a';

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error('Error: NOTION_TOKEN or NOTION_TV_DATABASE_ID is not configured.');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const EXTRA_SERIES = [
  { title: "Shogun", year: 2024, runtime: 60, rating: 8.7, genres: ["Drama", "Action & Adventure", "History"], synopsis: "When a mysterious English ship is found marooned in a nearby fishing village, Lord Yoshii Toranaga discovers secrets that could tilt the scales of power." },
  { title: "Succession", year: 2018, runtime: 60, rating: 8.8, genres: ["Drama", "Comedy"], synopsis: "The Roy family is known for controlling the biggest media and entertainment company in the world. However, their world changes when their father steps down." },
  { title: "The Last of Us", year: 2023, runtime: 50, rating: 8.8, genres: ["Drama", "Action & Adventure", "Sci-Fi"], synopsis: "After a global pandemic destroys civilization, a hardened survivor takes charge of a 14-year-old girl who may be humanity's last hope." },
  { title: "House of the Dragon", year: 2022, runtime: 60, rating: 8.4, genres: ["Action & Adventure", "Drama", "Fantasy"], synopsis: "An internal succession war within House Targaryen at the height of its power, 172 years before the birth of Daenerys Targaryen." },
  { title: "The Bear", year: 2022, runtime: 30, rating: 8.6, genres: ["Drama", "Comedy"], synopsis: "A young chef from the fine dining world returns to Chicago to run his family sandwich shop." },
  { title: "Severance", year: 2022, runtime: 45, rating: 8.7, genres: ["Drama", "Thriller", "Sci-Fi"], synopsis: "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives." },
  { title: "The White Lotus", year: 2021, runtime: 60, rating: 8.0, genres: ["Comedy", "Drama"], synopsis: "A sharp social satire following the exploits of various employees and guests at an exclusive Hawaiian resort over the span of one highly eventful week." },
  { title: "Ted Lasso", year: 2020, runtime: 30, rating: 8.8, genres: ["Comedy", "Drama"], synopsis: "American college football coach Ted Lasso is headed to London to manage a struggling English Premier League football team." },
  { title: "Euphoria", year: 2019, runtime: 55, rating: 8.3, genres: ["Drama"], synopsis: "A look at the lives of a group of high school students as they navigate love and friendships in a world of drugs, sex, trauma, and social media." },
  { title: "The Boys", year: 2019, runtime: 60, rating: 8.7, genres: ["Action & Adventure", "Comedy", "Sci-Fi"], synopsis: "A fun and irreverent take on what happens when superheroes, who are as popular as celebrities, abuse their superpowers." },
  { title: "Chernobyl", year: 2019, runtime: 60, rating: 9.3, genres: ["Drama", "History", "Thriller"], synopsis: "In April 1986, an explosion at the Chernobyl Nuclear Power Plant in the Union of Soviet Republics becomes one of the world's worst man-made catastrophes." },
  { title: "Stranger Things", year: 2016, runtime: 50, rating: 8.7, genres: ["Drama", "Fantasy", "Horror", "Sci-Fi"], synopsis: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl." },
  { title: "Fleabag", year: 2016, runtime: 25, rating: 8.7, genres: ["Comedy", "Drama"], synopsis: "A dry-witted woman, known only as Fleabag, navigates life and love in London while trying to cope with tragedy." },
  { title: "Attack on Titan", year: 2013, runtime: 24, rating: 9.1, genres: ["Animation", "Action & Adventure", "Fantasy"], synopsis: "After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction." },
  { title: "Arcane", year: 2021, runtime: 40, rating: 9.0, genres: ["Animation", "Action & Adventure", "Sci-Fi", "Fantasy"], synopsis: "Set in the utopian region of Piltover and the oppressed underground of Zaun, the story follows the origins of two iconic League champions and the power that will tear them apart." },
  { title: "Dark", year: 2017, runtime: 60, rating: 8.7, genres: ["Drama", "Mystery", "Sci-Fi"], synopsis: "A family saga with a supernatural twist, set in a German town where the disappearance of two young children exposes the relationships among four families." },
  { title: "The Mandalorian", year: 2019, runtime: 40, rating: 8.7, genres: ["Action & Adventure", "Sci-Fi", "Fantasy"], synopsis: "The travels of a lone bounty hunter in the outer reaches of the galaxy, far from the authority of the New Republic." },
  { title: "Better Call Saul", year: 2015, runtime: 46, rating: 9.0, genres: ["Crime", "Drama"], synopsis: "The trials and tribulations of criminal lawyer Jimmy McGill in the years leading up to his fateful run-in with Walter White." },
  { title: "Breaking Bad", year: 2008, runtime: 49, rating: 9.5, genres: ["Crime", "Drama", "Thriller"], synopsis: "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine with a former student." },
  { title: "The Wire", year: 2002, runtime: 60, rating: 9.3, genres: ["Crime", "Drama", "Thriller"], synopsis: "The Baltimore drug scene, as seen through the eyes of drug dealers and law enforcement." },
  { title: "The Sopranos", year: 1999, runtime: 55, rating: 9.2, genres: ["Crime", "Drama"], synopsis: "New Jersey mob boss Tony Soprano deals with personal and professional issues in his home and business life that affect his mental state." },
  { title: "The Office", year: 2005, runtime: 22, rating: 9.0, genres: ["Comedy"], synopsis: "A mockumentary on a group of typical office workers, where the workday consists of ego clashes, inappropriate behavior, and tedium." },
  { title: "Friends", year: 1994, runtime: 22, rating: 8.9, genres: ["Comedy", "Romance"], synopsis: "Follows the personal and professional lives of six twenty to thirty-something-year-old friends living in Manhattan." },
  { title: "Sherlock", year: 2010, runtime: 90, rating: 9.1, genres: ["Crime", "Drama", "Thriller"], synopsis: "A modern update finds the famous sleuth and his doctor partner solving crime in 21st century London." },
  { title: "Game of Thrones", year: 2011, runtime: 57, rating: 9.2, genres: ["Action & Adventure", "Drama", "Fantasy"], synopsis: "Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns." },
  { title: "True Detective", year: 2014, runtime: 55, rating: 8.9, genres: ["Crime", "Drama", "Thriller"], synopsis: "Seasonal anthology series in which police investigations reveal the personal and professional secrets of those involved." },
  { title: "Fargo", year: 2014, runtime: 53, rating: 8.9, genres: ["Crime", "Drama", "Thriller"], synopsis: "Various chronicles of deception, intrigue and murder in and around frozen Minnesota." },
  { title: "Black Mirror", year: 2011, runtime: 60, rating: 8.7, genres: ["Drama", "Sci-Fi", "Thriller"], synopsis: "An anthology series exploring a twisted, high-tech multiverse where humanity's greatest innovations and darkest instincts collide." },
  { title: "Twin Peaks", year: 1990, runtime: 47, rating: 8.8, genres: ["Drama", "Mystery"], synopsis: "An idiosyncratic FBI agent investigates the murder of a young woman in the even more idiosyncratic town of Twin Peaks." },
  { title: "Neon Genesis Evangelion", year: 1995, runtime: 24, rating: 8.5, genres: ["Animation", "Action & Adventure", "Sci-Fi", "Drama"], synopsis: "A teenage boy finds himself recruited by his father to pilot a giant bio-machine into combat against extraterrestrial beings." },
  { title: "The Crown", year: 2016, runtime: 58, rating: 8.6, genres: ["Drama", "History"], synopsis: "Follows the political rivalries and romance of Queen Elizabeth II's reign and the events that shaped the second half of the twentieth century." },
  { title: "Peaky Blinders", year: 2013, runtime: 60, rating: 8.8, genres: ["Crime", "Drama"], synopsis: "A gangster family epic set in 1919 Birmingham, England, centered on a gang who sew razor blades in the peaks of their caps." },
  { title: "Narcos", year: 2015, runtime: 49, rating: 8.8, genres: ["Crime", "Drama"], synopsis: "A chronicled look at the criminal exploits of Colombian drug lord Pablo Escobar, as well as many other drug kingpins who plagued the country through the years." },
  { title: "Mindhunter", year: 2017, runtime: 60, rating: 8.6, genres: ["Crime", "Drama", "Thriller"], synopsis: "In the late 1970s two FBI agents expand criminal science by delving into the psychology of murder and uneasily getting too close to real-life monsters." },
  { title: "The Queen's Gambit", year: 2020, runtime: 56, rating: 8.5, genres: ["Drama"], synopsis: "Orphaned at the tender age of nine, prodigious introvert Beth Harmon discovers and masters the game of chess in 1960s USA." },
  { title: "Modern Family", year: 2009, runtime: 22, rating: 8.5, genres: ["Comedy"], synopsis: "Three different but related families face trials and tribulations in their own uniquely hilarious ways." },
  { title: "The Big Bang Theory", year: 2007, runtime: 22, rating: 8.2, genres: ["Comedy"], synopsis: "A woman who moves into an apartment across the hall from two brilliant but socially awkward physicists shows them how little they know about life." },
  { title: "How I Met Your Mother", year: 2005, runtime: 22, rating: 8.3, genres: ["Comedy", "Romance"], synopsis: "A father recounts to his children - through a series of flashbacks - the journey he and his four best friends took leading up to him meeting their mother." },
  { title: "Parks and Recreation", year: 2009, runtime: 22, rating: 8.6, genres: ["Comedy"], synopsis: "The absurd antics of an Indiana town's public officials as they pursue sundry projects to make their city a better place." },
  { title: "Brooklyn Nine-Nine", year: 2013, runtime: 22, rating: 8.4, genres: ["Comedy", "Crime"], synopsis: "Comedy series following the exploits of Det. Jake Peralta and his diverse, lovable colleagues as they police the NYPD's 99th Precinct." },
  { title: "Arrested Development", year: 2003, runtime: 22, rating: 8.7, genres: ["Comedy"], synopsis: "Level-headed son Michael Bluth takes over family affairs after his father is imprisoned. But the rest of his spoiled, dysfunctional family are making his job difficult." },
  { title: "Community", year: 2009, runtime: 22, rating: 8.5, genres: ["Comedy"], synopsis: "A suspended lawyer is forced to enroll in a community college with an eccentric staff and student body." },
  { title: "It's Always Sunny in Philadelphia", year: 2005, runtime: 22, rating: 8.8, genres: ["Comedy"], synopsis: "Five fawning, narcissistic friends run a struggling Irish pub in Philadelphia." },
  { title: "Seinfeld", year: 1989, runtime: 22, rating: 8.9, genres: ["Comedy"], synopsis: "The continuing misadventures of neurotic New York City stand-up comedian Jerry Seinfeld and his equally neurotic New York friends." },
  { title: "The Simpsons", year: 1989, runtime: 22, rating: 8.7, genres: ["Animation", "Comedy"], synopsis: "The satiric adventures of a working-class family in the misfit city of Springfield." },
  { title: "South Park", year: 1997, runtime: 22, rating: 8.7, genres: ["Animation", "Comedy"], synopsis: "Follows the misadventures of four irreverent grade-schoolers in the quiet, dysfunctional town of South Park, Colorado." },
  { title: "Futurama", year: 1999, runtime: 22, rating: 8.5, genres: ["Animation", "Comedy", "Sci-Fi"], synopsis: "Philip J. Fry, a pizza delivery boy, is accidentally frozen in 1999 and thawed out in the year 3000." },
  { title: "BoJack Horseman", year: 2014, runtime: 25, rating: 8.8, genres: ["Animation", "Comedy", "Drama"], synopsis: "BoJack Horseman, the washed-up star of the 1990s sitcom Horsin' Around, navigates his personal life and career in Hollywood." },
  { title: "Cowboy Bebop", year: 1998, runtime: 24, rating: 8.9, genres: ["Animation", "Action & Adventure", "Sci-Fi"], synopsis: "The futuristic misadventures of an easygoing bounty hunter and his partners." },
  { title: "Death Note", year: 2006, runtime: 24, rating: 8.9, genres: ["Animation", "Crime", "Thriller"], synopsis: "An intelligent high school student goes on a secret crusade to eliminate criminals from the world after discovering a notebook capable of killing anyone." },
  { title: "Fullmetal Alchemist: Brotherhood", year: 2009, runtime: 24, rating: 9.1, genres: ["Animation", "Action & Adventure", "Fantasy"], synopsis: "Two brothers search for a Philosopher's Stone after an attempt to revive their deceased mother goes horribly wrong." },
  { title: "Demon Slayer", year: 2019, runtime: 24, rating: 8.6, genres: ["Animation", "Action & Adventure", "Fantasy"], synopsis: "A family is attacked by demons and only two members survive - Tanjiro and his sister Nezuko, who is turning into a demon slowly." },
  { title: "One Piece", year: 1999, runtime: 24, rating: 9.0, genres: ["Animation", "Action & Adventure"], synopsis: "Monkey D. Luffy and his pirate crew explore a fantastical world of endless oceans and exotic islands in search of the world's ultimate treasure." },
  { title: "Naruto: Shippuden", year: 2007, runtime: 24, rating: 8.7, genres: ["Animation", "Action & Adventure", "Fantasy"], synopsis: "Naruto Uzumaki, an adolescent ninja, constantly searches for recognition and dreams of becoming the Hokage, the leader of his village." },
  { title: "Hunter x Hunter", year: 2011, runtime: 24, rating: 9.0, genres: ["Animation", "Action & Adventure"], synopsis: "Gon Freecss aspires to become a Hunter, an exceptional being capable of greatness. With his friends, Gon seeks to find his lost father." },
  { title: "Dragon Ball Z", year: 1989, runtime: 24, rating: 8.8, genres: ["Animation", "Action & Adventure", "Sci-Fi"], synopsis: "After learning that he is from another planet, a warrior named Goku and his friends defend Earth from alien onslaughts." },
  { title: "Dexter", year: 2006, runtime: 55, rating: 8.6, genres: ["Crime", "Drama", "Thriller"], synopsis: "He's smart. He's lovable. He's Dexter Morgan, America's favorite serial killer, who spends his days solving crimes and nights committing them." },
  { title: "Hannibal", year: 2013, runtime: 44, rating: 8.5, genres: ["Crime", "Drama", "Thriller"], synopsis: "Explores the early relationship between renowned psychiatrist Hannibal Lecter and a young FBI criminal profiler, haunted by his ability to empathize with serial killers." },
  { title: "Mr. Robot", year: 2015, runtime: 49, rating: 8.5, genres: ["Drama", "Thriller", "Sci-Fi"], synopsis: "Elliot, a brilliant but highly unstable young cyber-security engineer and vigilante hacker, becomes a key figure in a complex game of global dominance." },
  { title: "Mad Men", year: 2007, runtime: 47, rating: 8.7, genres: ["Drama"], synopsis: "A drama about one of New York's most prestigious ad agencies in the beginning of the 1960s, focusing on one of the firm's most mysterious but extremely talented ad executives." },
  { title: "Lost", year: 2004, runtime: 44, rating: 8.3, genres: ["Drama", "Fantasy", "Action & Adventure"], synopsis: "The survivors of a plane crash are forced to work together in order to survive on a seemingly deserted tropical island." },
  { title: "Prison Break", year: 2005, runtime: 44, rating: 8.3, genres: ["Action & Adventure", "Crime", "Drama"], synopsis: "Due to a political conspiracy, an innocent man is sent to death row and his only hope is his brother, who makes it his mission to deliberately get himself sent to the same prison." },
  { title: "The Walking Dead", year: 2010, runtime: 44, rating: 8.1, genres: ["Drama", "Horror", "Thriller"], synopsis: "Sheriff Deputy Rick Grimes wakes up from a coma to learn the world is in ruins, and must lead a group of survivors to stay alive." },
  { title: "Yellowstone", year: 2018, runtime: 60, rating: 8.7, genres: ["Drama"], synopsis: "A ranching family in Montana faces off against others encroaching on their land." },
  { title: "The X-Files", year: 1993, runtime: 45, rating: 8.6, genres: ["Drama", "Mystery", "Sci-Fi"], synopsis: "Two FBI Agents, Fox Mulder the believer and Dana Scully the skeptic, investigate the strange and unexplained, while hidden forces work to impede their efforts." },
  { title: "Suits", year: 2011, runtime: 44, rating: 8.4, genres: ["Comedy", "Drama"], synopsis: "On the run from a drug deal gone bad, brilliant college dropout Mike Ross finds himself working with Harvey Specter, one of New York City's best lawyers." },
  { title: "House", year: 2004, runtime: 44, rating: 8.7, genres: ["Drama", "Mystery"], synopsis: "An antisocial maverick doctor who specializes in diagnostic medicine does whatever it takes to solve puzzling cases that come his way." },
  { title: "Grey's Anatomy", year: 2005, runtime: 41, rating: 7.6, genres: ["Drama", "Romance"], synopsis: "A drama centered on the personal and professional lives of five surgical interns and their supervisors." },
  { title: "The Twilight Zone", year: 1959, runtime: 25, rating: 9.1, genres: ["Drama", "Fantasy", "Sci-Fi"], synopsis: "Ordinary people find themselves in extraordinarily astounding situations, which each resolve in a stunning, unexpected twist." },
  { title: "Band of Brothers", year: 2001, runtime: 70, rating: 9.4, genres: ["Drama", "History", "War"], synopsis: "The story of Easy Company of the U.S. Army 101st Airborne Division and their mission in World War II Europe." },
  { title: "Rome", year: 2005, runtime: 52, rating: 8.7, genres: ["Action & Adventure", "Drama", "History"], synopsis: "A down-to-earth look at the lives of two ordinary Roman soldiers during the reigns of Julius Caesar and his successors." },
  { title: "Boardwalk Empire", year: 2010, runtime: 57, rating: 8.6, genres: ["Crime", "Drama", "History"], synopsis: "An Atlantic City politician plays both sides of the law by conspiring with gangsters during the Prohibition era." },
  { title: "Westworld", year: 2016, runtime: 62, rating: 8.5, genres: ["Drama", "Mystery", "Sci-Fi"], synopsis: "At the intersection of the near future and the reimagined past, explore a world in which every human appetite can be indulged." },
  { title: "Atlanta", year: 2016, runtime: 30, rating: 8.6, genres: ["Comedy", "Drama"], synopsis: "Earnest 'Earn' Marks and his cousin Alfred 'Paper Boi' Miles try to make their way in the Atlanta rap scene." },
  { title: "Barry", year: 2018, runtime: 30, rating: 8.4, genres: ["Action & Adventure", "Comedy", "Crime"], synopsis: "A hitman from the Midwest moves to Los Angeles and gets caught up in the city's theatre arts scene." },
  { title: "Deadwood", year: 2004, runtime: 55, rating: 8.6, genres: ["Crime", "Drama"], synopsis: "A show about the people of Deadwood, South Dakota, a town of outlaws and immigrants in the late 1800s." },
  { title: "Justified", year: 2010, runtime: 44, rating: 8.6, genres: ["Action & Adventure", "Crime", "Drama"], synopsis: "U.S. Marshal Raylan Givens is reassigned from Miami to his childhood home in the coal-mining towns of Eastern Kentucky." },
  { title: "The Shield", year: 2002, runtime: 47, rating: 8.7, genres: ["Crime", "Drama", "Thriller"], synopsis: "Follows the lives and cases of a dirty but highly effective experimental police unit in Los Angeles." },
  { title: "Sons of Anarchy", year: 2008, runtime: 45, rating: 8.6, genres: ["Crime", "Drama", "Thriller"], synopsis: "A man in his early thirties struggles to find a balance between being a new father and his involvement in an outlaw motorcycle club." },
  { title: "Vikings", year: 2013, runtime: 44, rating: 8.5, genres: ["Action & Adventure", "Drama"], synopsis: "Vikings transports us to the brutal and mysterious world of Ragnar Lothbrok, a Viking warrior and farmer who yearns to explore and raid the distant shores across the ocean." }
];

function cleanSearchTitle(title) {
  return title
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getTvMazeMetadata(title) {
  const queryAttempts = [
    title,
    title.replace(/^(The)\s+/i, '').trim(),
    cleanSearchTitle(title),
    title.split(':')[0].trim(),
    title.split('/')[0].trim()
  ];
  
  const uniqueQueries = [...new Set(queryAttempts.map(q => q.trim()).filter(Boolean))];
  
  for (const q of uniqueQueries) {
    if (!q) continue;
    try {
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(q)}`;
      const response = await axios.get(url);
      if (response.data) {
        const largeCover = response.data.image ? (response.data.image.original || response.data.image.medium) : '';
        const network = response.data.network ? response.data.network.name : (response.data.webChannel ? response.data.webChannel.name : '');
        const genres = response.data.genres || [];
        if (largeCover) {
          return { largeCover, network, genres };
        }
      }
    } catch (err) {
      // Singlesearch failed, fall through to fallback list search
    }

    try {
      const fallbackUrl = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`;
      const resFallback = await axios.get(fallbackUrl);
      if (resFallback.data && resFallback.data.length > 0) {
        const matchingShow = resFallback.data.find(d => d.show && d.show.image);
        if (matchingShow) {
          const show = matchingShow.show;
          const largeCover = show.image.original || show.image.medium || '';
          const network = show.network ? show.network.name : (show.webChannel ? show.webChannel.name : '');
          const genres = show.genres || [];
          if (largeCover) {
            return { largeCover, network, genres };
          }
        }
      }
    } catch (e) {
      // Ignore fallback failures
    }
  }
  return { largeCover: '', network: '', genres: [] };
}

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

function mapGenres(genresArray) {
  const allowed = new Set(['Action & Adventure', 'Sci-Fi', 'Drama', 'Thriller', 'Romance', 'Comedy', 'Animation', 'Horror', 'Crime', 'Fantasy']);
  const mapped = [];

  for (const name of genresArray) {
    if (allowed.has(name)) {
      mapped.push(name);
    } else if (name === 'Science Fiction' || name === 'Sci-Fi' || name === 'Science-Fiction') {
      mapped.push('Sci-Fi');
    } else if (name === 'Action' || name === 'Adventure' || name === 'War') {
      mapped.push('Action & Adventure');
    } else if (name === 'Mystery' || name === 'Suspense') {
      mapped.push('Thriller');
    } else if (name === 'Family' || name === 'Supernatural') {
      mapped.push('Fantasy');
    } else if (name === 'Biography' || name === 'History' || name === 'Western' || name === 'Medical' || name === 'Legal') {
      mapped.push('Drama');
    }
  }
  return [...new Set(mapped)];
}

async function start() {
  console.log('====================================================');
  console.log('🚀 Seeding Curated Famous TV Series to Notion...');
  console.log('====================================================');

  try {
    const cache = await fetchNotionCache();
    console.log(`Loaded cache: ${cache.size} existing TV Series found in Notion.`);

    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < EXTRA_SERIES.length; i++) {
      const s = EXTRA_SERIES[i];
      const cacheKey = s.title.toLowerCase().trim();

      if (cache.has(cacheKey)) {
        console.log(`[Skipping] "${s.title}" is already in your database.`);
        skipped++;
        continue;
      }

      console.log(`\nProcessing: "${s.title}" (${s.year})`);
      
      // Fetch dynamic cover and network platform from TVMaze keylessly
      console.log(`  Resolving cover poster and platform from TVMaze...`);
      const metadata = await getTvMazeMetadata(s.title);
      const coverUrl = metadata.largeCover;
      if (coverUrl) {
        console.log(`  Resolved Cover: ${coverUrl}`);
      } else {
        console.log(`  ⚠️ Failed to resolve cover.`);
      }
      if (metadata.network) {
        console.log(`  Resolved Network: ${metadata.network}`);
      }

      // Live search YouTube trailer link keylessly
      console.log(`  Searching YouTube trailer...`);
      const trailerUrl = await getYoutubeTrailer(s.title, s.year);
      if (trailerUrl) {
        console.log(`  Resolved Trailer: ${trailerUrl}`);
      } else {
        console.log(`  No trailer resolved.`);
      }

      // Combine genres
      const allGenres = [...new Set([...s.genres, ...metadata.genres])];
      const genres = mapGenres(allGenres);

      // Build properties
      const properties = {
        'Title': { title: [{ text: { content: s.title } }] },
        'Status': { status: { name: 'Plan to Watch' } }, // Status is a status property in TV Series database
        'Synopsis': { rich_text: [{ text: { content: s.synopsis } }] },
        'ReleaseYear': { number: s.year },
        'Runtime': { number: s.runtime },
        'IMDbRating': { number: s.rating }
      };

      if (genres.length > 0) {
        properties['Genre'] = { multi_select: genres.map(g => ({ name: g })) };
      }

      if (metadata.network) {
        properties['Platform'] = { multi_select: [{ name: metadata.network }] };
      }

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
        console.log(`  [Inserting] "${s.title}" into Notion...`);
        await notion.pages.create(pageData);
        inserted++;
        await sleep(350); // safe limit delay
      } catch (err) {
        console.error(`  ⚠️ Failed to insert "${s.title}":`, err.message);
      }
    }

    console.log('\n====================================================');
    console.log('🎉 Seeding Extra Famous TV Series Complete!');
    console.log(`🟢 Successfully Seeded: ${inserted} new masterpieces.`);
    console.log(`⚪ Skipped (Already existed): ${skipped}`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Critical error in TV Series seeder:', error.message);
  }
}

start();
