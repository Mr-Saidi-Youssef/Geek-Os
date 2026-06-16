/**
 * import_top_books.js
 * Imports the most famous ~2000 books into your Notion Library database.
 * Uses the Open Library API (free, no key required) for metadata + covers.
 * Developed for Byronotion Books Collection
 */

const { Client } = require('@notionhq/client');
const axios = require('axios');
require('dotenv').config();

const NOTION_TOKEN  = process.env.NOTION_TOKEN;
const DATABASE_ID   = '8b2780bfd84442d8bcd95223152c0ece';

if (!NOTION_TOKEN) {
  console.error('\x1b[31mError: NOTION_TOKEN is not set in your .env file.\x1b[0m');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const sleep  = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── 2000 Most Famous Books ────────────────────────────────────────────────────
const BOOKS = [
  // ── Classics ──────────────────────────────────────────────────────────────
  { title: "To Kill a Mockingbird",            author: "Harper Lee",                year: 1960, pages: 281,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "1984",                             author: "George Orwell",             year: 1949, pages: 328,  type: "Fiction",     genre: "Dystopian" },
  { title: "The Great Gatsby",                 author: "F. Scott Fitzgerald",       year: 1925, pages: 180,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Pride and Prejudice",              author: "Jane Austen",               year: 1813, pages: 432,  type: "Fiction",     genre: "Romance" },
  { title: "The Catcher in the Rye",           author: "J.D. Salinger",             year: 1951, pages: 277,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Brave New World",                  author: "Aldous Huxley",             year: 1932, pages: 311,  type: "Fiction",     genre: "Dystopian" },
  { title: "Of Mice and Men",                  author: "John Steinbeck",            year: 1937, pages: 112,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Grapes of Wrath",              author: "John Steinbeck",            year: 1939, pages: 464,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Lord of the Flies",                author: "William Golding",           year: 1954, pages: 224,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Jane Eyre",                        author: "Charlotte Brontë",          year: 1847, pages: 532,  type: "Fiction",     genre: "Romance" },
  { title: "Wuthering Heights",                author: "Emily Brontë",              year: 1847, pages: 342,  type: "Fiction",     genre: "Gothic" },
  { title: "Frankenstein",                     author: "Mary Shelley",              year: 1818, pages: 280,  type: "Fiction",     genre: "Horror" },
  { title: "Dracula",                          author: "Bram Stoker",               year: 1897, pages: 418,  type: "Fiction",     genre: "Horror" },
  { title: "Crime and Punishment",             author: "Fyodor Dostoevsky",         year: 1866, pages: 671,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Brothers Karamazov",           author: "Fyodor Dostoevsky",         year: 1880, pages: 796,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "War and Peace",                    author: "Leo Tolstoy",               year: 1869, pages: 1225, type: "Fiction",     genre: "Historical Fiction" },
  { title: "Anna Karenina",                    author: "Leo Tolstoy",               year: 1878, pages: 864,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Don Quixote",                      author: "Miguel de Cervantes",       year: 1605, pages: 1023, type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Odyssey",                      author: "Homer",                     year: -800, pages: 374,  type: "Fiction",     genre: "Epic Poetry" },
  { title: "The Iliad",                        author: "Homer",                     year: -800, pages: 704,  type: "Fiction",     genre: "Epic Poetry" },
  { title: "Hamlet",                           author: "William Shakespeare",       year: 1603, pages: 342,  type: "Fiction",     genre: "Drama" },
  { title: "Macbeth",                          author: "William Shakespeare",       year: 1606, pages: 108,  type: "Fiction",     genre: "Drama" },
  { title: "Romeo and Juliet",                 author: "William Shakespeare",       year: 1597, pages: 222,  type: "Fiction",     genre: "Drama" },
  { title: "A Tale of Two Cities",             author: "Charles Dickens",           year: 1859, pages: 489,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Great Expectations",               author: "Charles Dickens",           year: 1861, pages: 544,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Oliver Twist",                     author: "Charles Dickens",           year: 1839, pages: 480,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "David Copperfield",                author: "Charles Dickens",           year: 1850, pages: 882,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Les Misérables",                   author: "Victor Hugo",               year: 1862, pages: 1463, type: "Fiction",     genre: "Historical Fiction" },
  { title: "The Hunchback of Notre-Dame",      author: "Victor Hugo",               year: 1831, pages: 940,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Madame Bovary",                    author: "Gustave Flaubert",          year: 1856, pages: 329,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Count of Monte Cristo",        author: "Alexandre Dumas",           year: 1844, pages: 1276, type: "Fiction",     genre: "Adventure" },
  { title: "The Three Musketeers",             author: "Alexandre Dumas",           year: 1844, pages: 704,  type: "Fiction",     genre: "Adventure" },
  { title: "Moby-Dick",                        author: "Herman Melville",           year: 1851, pages: 720,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Scarlet Letter",               author: "Nathaniel Hawthorne",       year: 1850, pages: 238,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Adventures of Huckleberry Finn",   author: "Mark Twain",                year: 1884, pages: 366,  type: "Fiction",     genre: "Adventure" },
  { title: "The Adventures of Tom Sawyer",     author: "Mark Twain",                year: 1876, pages: 274,  type: "Fiction",     genre: "Adventure" },
  { title: "Sense and Sensibility",            author: "Jane Austen",               year: 1811, pages: 409,  type: "Fiction",     genre: "Romance" },
  { title: "Emma",                             author: "Jane Austen",               year: 1815, pages: 474,  type: "Fiction",     genre: "Romance" },
  { title: "Persuasion",                       author: "Jane Austen",               year: 1817, pages: 254,  type: "Fiction",     genre: "Romance" },
  { title: "Northanger Abbey",                 author: "Jane Austen",               year: 1817, pages: 250,  type: "Fiction",     genre: "Romance" },
  { title: "Middlemarch",                      author: "George Eliot",              year: 1871, pages: 904,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Mill on the Floss",            author: "George Eliot",              year: 1860, pages: 513,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Tess of the d'Urbervilles",        author: "Thomas Hardy",              year: 1891, pages: 518,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Far from the Madding Crowd",       author: "Thomas Hardy",              year: 1874, pages: 464,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Treasure Island",                  author: "Robert Louis Stevenson",    year: 1883, pages: 292,  type: "Fiction",     genre: "Adventure" },
  { title: "The Strange Case of Dr. Jekyll and Mr. Hyde", author: "Robert Louis Stevenson", year: 1886, pages: 144, type: "Fiction", genre: "Horror" },
  { title: "The Picture of Dorian Gray",       author: "Oscar Wilde",               year: 1890, pages: 254,  type: "Fiction",     genre: "Gothic" },
  { title: "Heart of Darkness",               author: "Joseph Conrad",             year: 1899, pages: 112,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Ulysses",                          author: "James Joyce",               year: 1922, pages: 730,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "A Portrait of the Artist as a Young Man", author: "James Joyce",       year: 1916, pages: 349,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Mrs Dalloway",                     author: "Virginia Woolf",            year: 1925, pages: 194,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "To the Lighthouse",               author: "Virginia Woolf",            year: 1927, pages: 209,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Waves",                        author: "Virginia Woolf",            year: 1931, pages: 229,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Sons and Lovers",                  author: "D.H. Lawrence",             year: 1913, pages: 467,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Lady Chatterley's Lover",          author: "D.H. Lawrence",             year: 1928, pages: 338,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Sun Also Rises",              author: "Ernest Hemingway",          year: 1926, pages: 251,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "A Farewell to Arms",              author: "Ernest Hemingway",          year: 1929, pages: 332,  type: "Fiction",     genre: "War" },
  { title: "For Whom the Bell Tolls",          author: "Ernest Hemingway",          year: 1940, pages: 480,  type: "Fiction",     genre: "War" },
  { title: "The Old Man and the Sea",          author: "Ernest Hemingway",          year: 1952, pages: 127,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Sound and the Fury",           author: "William Faulkner",          year: 1929, pages: 326,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "As I Lay Dying",                  author: "William Faulkner",          year: 1930, pages: 267,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Invisible Man",                    author: "Ralph Ellison",             year: 1952, pages: 581,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Native Son",                       author: "Richard Wright",            year: 1940, pages: 504,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Their Eyes Were Watching God",     author: "Zora Neale Hurston",        year: 1937, pages: 286,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Beloved",                          author: "Toni Morrison",             year: 1987, pages: 324,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Song of Solomon",                  author: "Toni Morrison",             year: 1977, pages: 337,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Bluest Eye",                   author: "Toni Morrison",             year: 1970, pages: 206,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Go Tell It on the Mountain",       author: "James Baldwin",             year: 1953, pages: 272,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Giovanni's Room",                  author: "James Baldwin",             year: 1956, pages: 159,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "One Hundred Years of Solitude",    author: "Gabriel García Márquez",    year: 1967, pages: 417,  type: "Fiction",     genre: "Magical Realism" },
  { title: "Love in the Time of Cholera",      author: "Gabriel García Márquez",    year: 1985, pages: 348,  type: "Fiction",     genre: "Magical Realism" },
  { title: "The House of the Spirits",         author: "Isabel Allende",            year: 1982, pages: 433,  type: "Fiction",     genre: "Magical Realism" },
  { title: "Ficciones",                        author: "Jorge Luis Borges",         year: 1944, pages: 174,  type: "Fiction",     genre: "Short Stories" },
  { title: "Pedro Páramo",                     author: "Juan Rulfo",                year: 1955, pages: 124,  type: "Fiction",     genre: "Magical Realism" },
  { title: "The Tin Drum",                     author: "Günter Grass",              year: 1959, pages: 600,  type: "Fiction",     genre: "Magical Realism" },
  { title: "The Trial",                        author: "Franz Kafka",               year: 1925, pages: 255,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Metamorphosis",                author: "Franz Kafka",               year: 1915, pages: 96,   type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Castle",                       author: "Franz Kafka",               year: 1926, pages: 352,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "In Search of Lost Time",           author: "Marcel Proust",             year: 1913, pages: 4215, type: "Fiction",     genre: "Literary Fiction" },
  { title: "Nausea",                           author: "Jean-Paul Sartre",          year: 1938, pages: 251,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Stranger",                     author: "Albert Camus",              year: 1942, pages: 123,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Plague",                       author: "Albert Camus",              year: 1947, pages: 308,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Siddhartha",                       author: "Hermann Hesse",             year: 1922, pages: 152,  type: "Fiction",     genre: "Philosophical" },
  { title: "Steppenwolf",                      author: "Hermann Hesse",             year: 1927, pages: 237,  type: "Fiction",     genre: "Philosophical" },
  { title: "Demian",                           author: "Hermann Hesse",             year: 1919, pages: 176,  type: "Fiction",     genre: "Philosophical" },
  { title: "The Magic Mountain",               author: "Thomas Mann",               year: 1924, pages: 720,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Death in Venice",                  author: "Thomas Mann",               year: 1912, pages: 111,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Buddenbrooks",                     author: "Thomas Mann",               year: 1901, pages: 736,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Unbearable Lightness of Being",author: "Milan Kundera",             year: 1984, pages: 314,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Book of Laughter and Forgetting", author: "Milan Kundera",          year: 1979, pages: 240,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Doctor Zhivago",                   author: "Boris Pasternak",           year: 1957, pages: 592,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "The Master and Margarita",         author: "Mikhail Bulgakov",          year: 1967, pages: 412,  type: "Fiction",     genre: "Magical Realism" },
  { title: "And Quiet Flows the Don",          author: "Mikhail Sholokhov",         year: 1940, pages: 800,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "One Day in the Life of Ivan Denisovich", author: "Alexander Solzhenitsyn", year: 1962, pages: 182, type: "Fiction",  genre: "Historical Fiction" },
  { title: "Lolita",                           author: "Vladimir Nabokov",          year: 1955, pages: 331,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Pale Fire",                        author: "Vladimir Nabokov",          year: 1962, pages: 315,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Name of the Rose",             author: "Umberto Eco",               year: 1980, pages: 502,  type: "Fiction",     genre: "Mystery" },
  { title: "If on a winter's night a traveler",author: "Italo Calvino",             year: 1979, pages: 260,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Invisible Cities",                 author: "Italo Calvino",             year: 1972, pages: 165,  type: "Fiction",     genre: "Magical Realism" },
  { title: "The Leopard",                      author: "Giuseppe Tomasi di Lampedusa", year: 1958, pages: 319, type: "Fiction",  genre: "Historical Fiction" },
  // ── Science Fiction ───────────────────────────────────────────────────────
  { title: "Dune",                             author: "Frank Herbert",             year: 1965, pages: 688,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Dune Messiah",                     author: "Frank Herbert",             year: 1969, pages: 352,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Children of Dune",                 author: "Frank Herbert",             year: 1976, pages: 444,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Foundation",                       author: "Isaac Asimov",              year: 1951, pages: 244,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Foundation and Empire",            author: "Isaac Asimov",              year: 1952, pages: 247,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Second Foundation",                author: "Isaac Asimov",              year: 1953, pages: 279,  type: "Fiction",     genre: "Science Fiction" },
  { title: "I, Robot",                         author: "Isaac Asimov",              year: 1950, pages: 224,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams",         year: 1979, pages: 193,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Restaurant at the End of the Universe", author: "Douglas Adams",    year: 1980, pages: 250,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Fahrenheit 451",                   author: "Ray Bradbury",              year: 1953, pages: 256,  type: "Fiction",     genre: "Dystopian" },
  { title: "The Martian Chronicles",           author: "Ray Bradbury",              year: 1950, pages: 268,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Something Wicked This Way Comes",  author: "Ray Bradbury",              year: 1962, pages: 304,  type: "Fiction",     genre: "Horror" },
  { title: "Slaughterhouse-Five",              author: "Kurt Vonnegut",             year: 1969, pages: 275,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Cat's Cradle",                     author: "Kurt Vonnegut",             year: 1963, pages: 304,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Breakfast of Champions",           author: "Kurt Vonnegut",             year: 1973, pages: 303,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Left Hand of Darkness",        author: "Ursula K. Le Guin",         year: 1969, pages: 304,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Dispossessed",                 author: "Ursula K. Le Guin",         year: 1974, pages: 387,  type: "Fiction",     genre: "Science Fiction" },
  { title: "A Wizard of Earthsea",             author: "Ursula K. Le Guin",         year: 1968, pages: 183,  type: "Fiction",     genre: "Fantasy" },
  { title: "Neuromancer",                      author: "William Gibson",            year: 1984, pages: 271,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Snow Crash",                       author: "Neal Stephenson",           year: 1992, pages: 440,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Cryptonomicon",                    author: "Neal Stephenson",           year: 1999, pages: 1152, type: "Fiction",     genre: "Science Fiction" },
  { title: "Ender's Game",                     author: "Orson Scott Card",          year: 1985, pages: 324,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Speaker for the Dead",             author: "Orson Scott Card",          year: 1986, pages: 415,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Handmaid's Tale",              author: "Margaret Atwood",           year: 1985, pages: 311,  type: "Fiction",     genre: "Dystopian" },
  { title: "Oryx and Crake",                   author: "Margaret Atwood",           year: 2003, pages: 376,  type: "Fiction",     genre: "Dystopian" },
  { title: "The Year of the Flood",            author: "Margaret Atwood",           year: 2009, pages: 431,  type: "Fiction",     genre: "Dystopian" },
  { title: "MaddAddam",                        author: "Margaret Atwood",           year: 2013, pages: 394,  type: "Fiction",     genre: "Dystopian" },
  { title: "Flowers for Algernon",             author: "Daniel Keyes",              year: 1966, pages: 311,  type: "Fiction",     genre: "Science Fiction" },
  { title: "A Wrinkle in Time",                author: "Madeleine L'Engle",         year: 1962, pages: 218,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Giver",                        author: "Lois Lowry",                year: 1993, pages: 179,  type: "Fiction",     genre: "Dystopian" },
  { title: "The Time Machine",                 author: "H.G. Wells",                year: 1895, pages: 118,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The War of the Worlds",            author: "H.G. Wells",                year: 1898, pages: 192,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Invisible Man",                author: "H.G. Wells",                year: 1897, pages: 224,  type: "Fiction",     genre: "Science Fiction" },
  { title: "20,000 Leagues Under the Sea",     author: "Jules Verne",               year: 1870, pages: 445,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Journey to the Center of the Earth",author: "Jules Verne",              year: 1864, pages: 327,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Around the World in 80 Days",      author: "Jules Verne",               year: 1872, pages: 256,  type: "Fiction",     genre: "Adventure" },
  { title: "Do Androids Dream of Electric Sheep?", author: "Philip K. Dick",        year: 1968, pages: 244,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Man in the High Castle",       author: "Philip K. Dick",            year: 1962, pages: 259,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Ubik",                             author: "Philip K. Dick",            year: 1969, pages: 224,  type: "Fiction",     genre: "Science Fiction" },
  { title: "A Scanner Darkly",                 author: "Philip K. Dick",            year: 1977, pages: 220,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Solaris",                          author: "Stanisław Lem",             year: 1961, pages: 204,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Contact",                          author: "Carl Sagan",                year: 1985, pages: 434,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Jurassic Park",                    author: "Michael Crichton",          year: 1990, pages: 399,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Andromeda Strain",             author: "Michael Crichton",          year: 1969, pages: 295,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Timeline",                         author: "Michael Crichton",          year: 1999, pages: 494,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Ready Player One",                 author: "Ernest Cline",              year: 2011, pages: 374,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Martian",                      author: "Andy Weir",                 year: 2011, pages: 369,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Project Hail Mary",                author: "Andy Weir",                 year: 2021, pages: 476,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Old Man's War",                    author: "John Scalzi",               year: 2005, pages: 351,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Starship Troopers",                author: "Robert A. Heinlein",        year: 1959, pages: 263,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Stranger in a Strange Land",       author: "Robert A. Heinlein",        year: 1961, pages: 408,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Moon is a Harsh Mistress",     author: "Robert A. Heinlein",        year: 1966, pages: 382,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Ringworld",                        author: "Larry Niven",               year: 1970, pages: 342,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Forever War",                  author: "Joe Haldeman",              year: 1974, pages: 236,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Hyperion",                         author: "Dan Simmons",               year: 1989, pages: 482,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Fall of Hyperion",             author: "Dan Simmons",               year: 1990, pages: 517,  type: "Fiction",     genre: "Science Fiction" },
  { title: "A Fire Upon the Deep",             author: "Vernor Vinge",              year: 1992, pages: 613,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Three-Body Problem",           author: "Liu Cixin",                 year: 2008, pages: 400,  type: "Fiction",     genre: "Science Fiction" },
  { title: "The Dark Forest",                  author: "Liu Cixin",                 year: 2008, pages: 512,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Death's End",                      author: "Liu Cixin",                 year: 2010, pages: 604,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Blindsight",                       author: "Peter Watts",               year: 2006, pages: 384,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Wool",                             author: "Hugh Howey",                year: 2012, pages: 507,  type: "Fiction",     genre: "Dystopian" },
  { title: "The Road",                         author: "Cormac McCarthy",           year: 2006, pages: 287,  type: "Fiction",     genre: "Dystopian" },
  { title: "Station Eleven",                   author: "Emily St. John Mandel",     year: 2014, pages: 333,  type: "Fiction",     genre: "Dystopian" },
  { title: "Never Let Me Go",                  author: "Kazuo Ishiguro",            year: 2005, pages: 288,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Klara and the Sun",                author: "Kazuo Ishiguro",            year: 2021, pages: 307,  type: "Fiction",     genre: "Science Fiction" },
  // ── Fantasy ───────────────────────────────────────────────────────────────
  { title: "The Lord of the Rings",            author: "J.R.R. Tolkien",            year: 1954, pages: 1178, type: "Fiction",     genre: "Fantasy" },
  { title: "The Hobbit",                       author: "J.R.R. Tolkien",            year: 1937, pages: 310,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Silmarillion",                 author: "J.R.R. Tolkien",            year: 1977, pages: 365,  type: "Fiction",     genre: "Fantasy" },
  { title: "Harry Potter and the Philosopher's Stone", author: "J.K. Rowling",      year: 1997, pages: 223,  type: "Fiction",     genre: "Fantasy" },
  { title: "Harry Potter and the Chamber of Secrets", author: "J.K. Rowling",       year: 1998, pages: 251,  type: "Fiction",     genre: "Fantasy" },
  { title: "Harry Potter and the Prisoner of Azkaban", author: "J.K. Rowling",      year: 1999, pages: 317,  type: "Fiction",     genre: "Fantasy" },
  { title: "Harry Potter and the Goblet of Fire", author: "J.K. Rowling",           year: 2000, pages: 636,  type: "Fiction",     genre: "Fantasy" },
  { title: "Harry Potter and the Order of the Phoenix", author: "J.K. Rowling",     year: 2003, pages: 766,  type: "Fiction",     genre: "Fantasy" },
  { title: "Harry Potter and the Half-Blood Prince", author: "J.K. Rowling",        year: 2005, pages: 607,  type: "Fiction",     genre: "Fantasy" },
  { title: "Harry Potter and the Deathly Hallows", author: "J.K. Rowling",          year: 2007, pages: 607,  type: "Fiction",     genre: "Fantasy" },
  { title: "A Game of Thrones",                author: "George R.R. Martin",        year: 1996, pages: 694,  type: "Fiction",     genre: "Fantasy" },
  { title: "A Clash of Kings",                 author: "George R.R. Martin",        year: 1998, pages: 768,  type: "Fiction",     genre: "Fantasy" },
  { title: "A Storm of Swords",               author: "George R.R. Martin",        year: 2000, pages: 1177, type: "Fiction",     genre: "Fantasy" },
  { title: "A Feast for Crows",               author: "George R.R. Martin",        year: 2005, pages: 784,  type: "Fiction",     genre: "Fantasy" },
  { title: "A Dance with Dragons",             author: "George R.R. Martin",        year: 2011, pages: 1056, type: "Fiction",     genre: "Fantasy" },
  { title: "The Name of the Wind",             author: "Patrick Rothfuss",          year: 2007, pages: 662,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Wise Man's Fear",              author: "Patrick Rothfuss",          year: 2011, pages: 994,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Way of Kings",                 author: "Brandon Sanderson",         year: 2010, pages: 1007, type: "Fiction",     genre: "Fantasy" },
  { title: "Words of Radiance",               author: "Brandon Sanderson",         year: 2014, pages: 1087, type: "Fiction",     genre: "Fantasy" },
  { title: "Oathbringer",                      author: "Brandon Sanderson",         year: 2017, pages: 1248, type: "Fiction",     genre: "Fantasy" },
  { title: "Rhythm of War",                    author: "Brandon Sanderson",         year: 2020, pages: 1232, type: "Fiction",     genre: "Fantasy" },
  { title: "Mistborn: The Final Empire",       author: "Brandon Sanderson",         year: 2006, pages: 541,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Well of Ascension",            author: "Brandon Sanderson",         year: 2007, pages: 590,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Hero of Ages",                 author: "Brandon Sanderson",         year: 2008, pages: 572,  type: "Fiction",     genre: "Fantasy" },
  { title: "Elantris",                         author: "Brandon Sanderson",         year: 2005, pages: 496,  type: "Fiction",     genre: "Fantasy" },
  { title: "Warbreaker",                       author: "Brandon Sanderson",         year: 2009, pages: 592,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Sword of Kaigen",              author: "M.L. Wang",                 year: 2019, pages: 362,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Eye of the World",             author: "Robert Jordan",             year: 1990, pages: 782,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Great Hunt",                   author: "Robert Jordan",             year: 1990, pages: 599,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Dragon Reborn",                author: "Robert Jordan",             year: 1991, pages: 675,  type: "Fiction",     genre: "Fantasy" },
  { title: "Assassin's Apprentice",            author: "Robin Hobb",                year: 1995, pages: 356,  type: "Fiction",     genre: "Fantasy" },
  { title: "Royal Assassin",                   author: "Robin Hobb",                year: 1996, pages: 675,  type: "Fiction",     genre: "Fantasy" },
  { title: "Assassin's Quest",                 author: "Robin Hobb",                year: 1997, pages: 757,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Lies of Locke Lamora",         author: "Scott Lynch",               year: 2006, pages: 499,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Blade Itself",                 author: "Joe Abercrombie",           year: 2006, pages: 515,  type: "Fiction",     genre: "Fantasy" },
  { title: "Before They Are Hanged",           author: "Joe Abercrombie",           year: 2007, pages: 543,  type: "Fiction",     genre: "Fantasy" },
  { title: "Last Argument of Kings",           author: "Joe Abercrombie",           year: 2008, pages: 639,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Shadow of the Wind",           author: "Carlos Ruiz Zafón",         year: 2001, pages: 487,  type: "Fiction",     genre: "Mystery" },
  { title: "Jonathan Strange & Mr Norrell",    author: "Susanna Clarke",            year: 2004, pages: 1006, type: "Fiction",     genre: "Fantasy" },
  { title: "Piranesi",                         author: "Susanna Clarke",            year: 2020, pages: 272,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Night Circus",                 author: "Erin Morgenstern",          year: 2011, pages: 387,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Bear and the Nightingale",     author: "Katherine Arden",           year: 2017, pages: 323,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Girl with the Dragon Tattoo", author: "Stieg Larsson",             year: 2005, pages: 465,  type: "Fiction",     genre: "Thriller" },
  { title: "American Gods",                    author: "Neil Gaiman",               year: 2001, pages: 465,  type: "Fiction",     genre: "Fantasy" },
  { title: "Good Omens",                       author: "Neil Gaiman",               year: 1990, pages: 288,  type: "Fiction",     genre: "Fantasy" },
  { title: "Stardust",                         author: "Neil Gaiman",               year: 1999, pages: 248,  type: "Fiction",     genre: "Fantasy" },
  { title: "Coraline",                         author: "Neil Gaiman",               year: 2002, pages: 162,  type: "Fiction",     genre: "Fantasy" },
  { title: "Norse Mythology",                  author: "Neil Gaiman",               year: 2017, pages: 299,  type: "Fiction",     genre: "Mythology" },
  { title: "The Ocean at the End of the Lane", author: "Neil Gaiman",               year: 2013, pages: 181,  type: "Fiction",     genre: "Fantasy" },
  { title: "His Dark Materials: Northern Lights", author: "Philip Pullman",          year: 1995, pages: 399,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Subtle Knife",                 author: "Philip Pullman",            year: 1997, pages: 326,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Amber Spyglass",               author: "Philip Pullman",            year: 2000, pages: 518,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Lion, the Witch and the Wardrobe", author: "C.S. Lewis",            year: 1950, pages: 172,  type: "Fiction",     genre: "Fantasy" },
  { title: "Prince Caspian",                   author: "C.S. Lewis",                year: 1951, pages: 195,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Voyage of the Dawn Treader",   author: "C.S. Lewis",                year: 1952, pages: 216,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Screwtape Letters",            author: "C.S. Lewis",                year: 1942, pages: 212,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "Mere Christianity",                author: "C.S. Lewis",                year: 1952, pages: 227,  type: "Non-Fiction", genre: "Religion" },
  { title: "Eragon",                           author: "Christopher Paolini",       year: 2003, pages: 503,  type: "Fiction",     genre: "Fantasy" },
  { title: "Eldest",                           author: "Christopher Paolini",       year: 2005, pages: 668,  type: "Fiction",     genre: "Fantasy" },
  { title: "Brisingr",                         author: "Christopher Paolini",       year: 2008, pages: 748,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Throne of Glass",              author: "Sarah J. Maas",             year: 2012, pages: 406,  type: "Fiction",     genre: "Fantasy" },
  { title: "A Court of Thorns and Roses",      author: "Sarah J. Maas",             year: 2015, pages: 419,  type: "Fiction",     genre: "Fantasy" },
  { title: "A Court of Mist and Fury",         author: "Sarah J. Maas",             year: 2016, pages: 626,  type: "Fiction",     genre: "Fantasy" },
  { title: "A Court of Wings and Ruin",        author: "Sarah J. Maas",             year: 2017, pages: 699,  type: "Fiction",     genre: "Fantasy" },
  { title: "From Blood and Ash",              author: "Jennifer L. Armentrout",    year: 2020, pages: 622,  type: "Fiction",     genre: "Fantasy" },
  { title: "Fourth Wing",                      author: "Rebecca Yarros",            year: 2023, pages: 517,  type: "Fiction",     genre: "Fantasy" },
  { title: "Iron Flame",                       author: "Rebecca Yarros",            year: 2023, pages: 623,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Poppy War",                    author: "R.F. Kuang",                year: 2018, pages: 544,  type: "Fiction",     genre: "Fantasy" },
  { title: "Babel",                            author: "R.F. Kuang",                year: 2022, pages: 545,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Priory of the Orange Tree",    author: "Samantha Shannon",          year: 2019, pages: 848,  type: "Fiction",     genre: "Fantasy" },
  { title: "Six of Crows",                     author: "Leigh Bardugo",             year: 2015, pages: 465,  type: "Fiction",     genre: "Fantasy" },
  { title: "Crooked Kingdom",                  author: "Leigh Bardugo",             year: 2016, pages: 536,  type: "Fiction",     genre: "Fantasy" },
  { title: "Shadow and Bone",                  author: "Leigh Bardugo",             year: 2012, pages: 358,  type: "Fiction",     genre: "Fantasy" },
  { title: "Siege and Storm",                  author: "Leigh Bardugo",             year: 2013, pages: 435,  type: "Fiction",     genre: "Fantasy" },
  { title: "Ruin and Rising",                  author: "Leigh Bardugo",             year: 2014, pages: 422,  type: "Fiction",     genre: "Fantasy" },
  { title: "King of Scars",                    author: "Leigh Bardugo",             year: 2019, pages: 514,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Stormlight Archive: Dawnshard",author: "Brandon Sanderson",         year: 2020, pages: 261,  type: "Fiction",     genre: "Fantasy" },
  { title: "Children of Blood and Bone",       author: "Tomi Adeyemi",              year: 2018, pages: 531,  type: "Fiction",     genre: "Fantasy" },
  { title: "An Ember in the Ashes",            author: "Sabaa Tahir",               year: 2015, pages: 446,  type: "Fiction",     genre: "Fantasy" },
  { title: "A Torch Against the Night",        author: "Sabaa Tahir",               year: 2016, pages: 464,  type: "Fiction",     genre: "Fantasy" },
  { title: "Red Rising",                       author: "Pierce Brown",              year: 2014, pages: 382,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Golden Son",                       author: "Pierce Brown",              year: 2015, pages: 442,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Morning Star",                     author: "Pierce Brown",              year: 2016, pages: 518,  type: "Fiction",     genre: "Science Fiction" },
  { title: "Mistborn: The Alloy of Law",       author: "Brandon Sanderson",         year: 2011, pages: 332,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Dresden Files: Storm Front",   author: "Jim Butcher",               year: 2000, pages: 322,  type: "Fiction",     genre: "Fantasy" },
  { title: "Guards! Guards!",                  author: "Terry Pratchett",           year: 1989, pages: 288,  type: "Fiction",     genre: "Fantasy" },
  { title: "Small Gods",                       author: "Terry Pratchett",           year: 1992, pages: 284,  type: "Fiction",     genre: "Fantasy" },
  { title: "Night Watch",                      author: "Terry Pratchett",           year: 2002, pages: 338,  type: "Fiction",     genre: "Fantasy" },
  { title: "Going Postal",                     author: "Terry Pratchett",           year: 2004, pages: 471,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Colour of Magic",              author: "Terry Pratchett",           year: 1983, pages: 224,  type: "Fiction",     genre: "Fantasy" },
  { title: "Mort",                             author: "Terry Pratchett",           year: 1987, pages: 243,  type: "Fiction",     genre: "Fantasy" },
  { title: "Wyrd Sisters",                     author: "Terry Pratchett",           year: 1988, pages: 265,  type: "Fiction",     genre: "Fantasy" },
  { title: "Equal Rites",                      author: "Terry Pratchett",           year: 1987, pages: 212,  type: "Fiction",     genre: "Fantasy" },
  // ── Mystery / Thriller ────────────────────────────────────────────────────
  { title: "And Then There Were None",         author: "Agatha Christie",           year: 1939, pages: 272,  type: "Fiction",     genre: "Mystery" },
  { title: "Murder on the Orient Express",     author: "Agatha Christie",           year: 1934, pages: 256,  type: "Fiction",     genre: "Mystery" },
  { title: "The Murder of Roger Ackroyd",      author: "Agatha Christie",           year: 1926, pages: 288,  type: "Fiction",     genre: "Mystery" },
  { title: "Death on the Nile",               author: "Agatha Christie",           year: 1937, pages: 288,  type: "Fiction",     genre: "Mystery" },
  { title: "Evil Under the Sun",              author: "Agatha Christie",           year: 1941, pages: 254,  type: "Fiction",     genre: "Mystery" },
  { title: "A Pocket Full of Rye",             author: "Agatha Christie",           year: 1953, pages: 224,  type: "Fiction",     genre: "Mystery" },
  { title: "The Hound of the Baskervilles",    author: "Arthur Conan Doyle",        year: 1902, pages: 256,  type: "Fiction",     genre: "Mystery" },
  { title: "A Study in Scarlet",              author: "Arthur Conan Doyle",        year: 1887, pages: 144,  type: "Fiction",     genre: "Mystery" },
  { title: "The Adventures of Sherlock Holmes",author: "Arthur Conan Doyle",        year: 1892, pages: 307,  type: "Fiction",     genre: "Mystery" },
  { title: "In the Woods",                    author: "Tana French",               year: 2007, pages: 429,  type: "Fiction",     genre: "Mystery" },
  { title: "Gone Girl",                        author: "Gillian Flynn",             year: 2012, pages: 422,  type: "Fiction",     genre: "Thriller" },
  { title: "Sharp Objects",                   author: "Gillian Flynn",             year: 2006, pages: 254,  type: "Fiction",     genre: "Thriller" },
  { title: "Dark Places",                     author: "Gillian Flynn",             year: 2009, pages: 349,  type: "Fiction",     genre: "Thriller" },
  { title: "The Girl on the Train",            author: "Paula Hawkins",             year: 2015, pages: 395,  type: "Fiction",     genre: "Thriller" },
  { title: "The Silent Patient",              author: "Alex Michaelides",          year: 2019, pages: 325,  type: "Fiction",     genre: "Thriller" },
  { title: "The Thursday Murder Club",         author: "Richard Osman",             year: 2020, pages: 382,  type: "Fiction",     genre: "Mystery" },
  { title: "Big Little Lies",                 author: "Liane Moriarty",            year: 2014, pages: 460,  type: "Fiction",     genre: "Mystery" },
  { title: "The Woman in the Window",          author: "A.J. Finn",                 year: 2018, pages: 427,  type: "Fiction",     genre: "Thriller" },
  { title: "Behind Closed Doors",              author: "B.A. Paris",                year: 2016, pages: 352,  type: "Fiction",     genre: "Thriller" },
  { title: "The Da Vinci Code",               author: "Dan Brown",                 year: 2003, pages: 489,  type: "Fiction",     genre: "Thriller" },
  { title: "Angels and Demons",               author: "Dan Brown",                 year: 2000, pages: 736,  type: "Fiction",     genre: "Thriller" },
  { title: "Inferno",                         author: "Dan Brown",                 year: 2013, pages: 609,  type: "Fiction",     genre: "Thriller" },
  { title: "The Firm",                        author: "John Grisham",              year: 1991, pages: 421,  type: "Fiction",     genre: "Thriller" },
  { title: "A Time to Kill",                  author: "John Grisham",              year: 1989, pages: 432,  type: "Fiction",     genre: "Thriller" },
  { title: "The Pelican Brief",               author: "John Grisham",              year: 1992, pages: 378,  type: "Fiction",     genre: "Thriller" },
  { title: "The Rainmaker",                   author: "John Grisham",              year: 1995, pages: 434,  type: "Fiction",     genre: "Thriller" },
  { title: "The Client",                      author: "John Grisham",              year: 1993, pages: 422,  type: "Fiction",     genre: "Thriller" },
  { title: "Along Came a Spider",             author: "James Patterson",           year: 1993, pages: 435,  type: "Fiction",     genre: "Thriller" },
  { title: "Kiss the Girls",                  author: "James Patterson",           year: 1995, pages: 451,  type: "Fiction",     genre: "Thriller" },
  { title: "The Girl with the Dragon Tattoo",  author: "Stieg Larsson",             year: 2005, pages: 465,  type: "Fiction",     genre: "Mystery" },
  { title: "The Girl Who Played with Fire",    author: "Stieg Larsson",             year: 2006, pages: 503,  type: "Fiction",     genre: "Mystery" },
  { title: "Rebecca",                          author: "Daphne du Maurier",         year: 1938, pages: 449,  type: "Fiction",     genre: "Mystery" },
  { title: "Jamaica Inn",                      author: "Daphne du Maurier",         year: 1936, pages: 320,  type: "Fiction",     genre: "Mystery" },
  { title: "Tinker, Tailor, Soldier, Spy",    author: "John le Carré",             year: 1974, pages: 355,  type: "Fiction",     genre: "Thriller" },
  { title: "The Spy Who Came in from the Cold",author: "John le Carré",             year: 1963, pages: 224,  type: "Fiction",     genre: "Thriller" },
  { title: "Casino Royale",                    author: "Ian Fleming",               year: 1953, pages: 213,  type: "Fiction",     genre: "Thriller" },
  { title: "Dr. No",                          author: "Ian Fleming",               year: 1958, pages: 256,  type: "Fiction",     genre: "Thriller" },
  { title: "Goldfinger",                       author: "Ian Fleming",               year: 1959, pages: 318,  type: "Fiction",     genre: "Thriller" },
  { title: "The Maltese Falcon",               author: "Dashiell Hammett",          year: 1930, pages: 217,  type: "Fiction",     genre: "Mystery" },
  { title: "The Big Sleep",                    author: "Raymond Chandler",          year: 1939, pages: 231,  type: "Fiction",     genre: "Mystery" },
  { title: "Farewell, My Lovely",              author: "Raymond Chandler",          year: 1940, pages: 272,  type: "Fiction",     genre: "Mystery" },
  { title: "In the Electric Mist with Confederate Dead", author: "James Lee Burke",  year: 1993, pages: 352,  type: "Fiction",     genre: "Mystery" },
  { title: "Still Life",                       author: "Louise Penny",              year: 2005, pages: 312,  type: "Fiction",     genre: "Mystery" },
  { title: "The No. 1 Ladies' Detective Agency", author: "Alexander McCall Smith",  year: 1998, pages: 235,  type: "Fiction",     genre: "Mystery" },
  // ── Horror ────────────────────────────────────────────────────────────────
  { title: "It",                               author: "Stephen King",              year: 1986, pages: 1138, type: "Fiction",     genre: "Horror" },
  { title: "The Shining",                      author: "Stephen King",              year: 1977, pages: 447,  type: "Fiction",     genre: "Horror" },
  { title: "Pet Sematary",                     author: "Stephen King",              year: 1983, pages: 373,  type: "Fiction",     genre: "Horror" },
  { title: "Carrie",                           author: "Stephen King",              year: 1974, pages: 199,  type: "Fiction",     genre: "Horror" },
  { title: "The Stand",                        author: "Stephen King",              year: 1978, pages: 823,  type: "Fiction",     genre: "Horror" },
  { title: "Misery",                           author: "Stephen King",              year: 1987, pages: 310,  type: "Fiction",     genre: "Horror" },
  { title: "The Dark Tower: The Gunslinger",   author: "Stephen King",              year: 1982, pages: 224,  type: "Fiction",     genre: "Fantasy" },
  { title: "Doctor Sleep",                     author: "Stephen King",              year: 2013, pages: 531,  type: "Fiction",     genre: "Horror" },
  { title: "Needful Things",                   author: "Stephen King",              year: 1991, pages: 690,  type: "Fiction",     genre: "Horror" },
  { title: "Cujo",                             author: "Stephen King",              year: 1981, pages: 319,  type: "Fiction",     genre: "Horror" },
  { title: "Christine",                        author: "Stephen King",              year: 1983, pages: 526,  type: "Fiction",     genre: "Horror" },
  { title: "The Exorcist",                     author: "William Peter Blatty",      year: 1971, pages: 340,  type: "Fiction",     genre: "Horror" },
  { title: "Rosemary's Baby",                  author: "Ira Levin",                 year: 1967, pages: 245,  type: "Fiction",     genre: "Horror" },
  { title: "American Psycho",                  author: "Bret Easton Ellis",         year: 1991, pages: 412,  type: "Fiction",     genre: "Thriller" },
  { title: "The Silence of the Lambs",         author: "Thomas Harris",             year: 1988, pages: 338,  type: "Fiction",     genre: "Thriller" },
  { title: "Red Dragon",                       author: "Thomas Harris",             year: 1981, pages: 351,  type: "Fiction",     genre: "Thriller" },
  { title: "House of Leaves",                  author: "Mark Z. Danielewski",       year: 2000, pages: 709,  type: "Fiction",     genre: "Horror" },
  { title: "The Haunting of Hill House",       author: "Shirley Jackson",           year: 1959, pages: 246,  type: "Fiction",     genre: "Horror" },
  { title: "We Have Always Lived in the Castle", author: "Shirley Jackson",          year: 1962, pages: 146,  type: "Fiction",     genre: "Gothic" },
  // ── Romance ───────────────────────────────────────────────────────────────
  { title: "Outlander",                        author: "Diana Gabaldon",            year: 1991, pages: 627,  type: "Fiction",     genre: "Romance" },
  { title: "Dragonfly in Amber",               author: "Diana Gabaldon",            year: 1992, pages: 743,  type: "Fiction",     genre: "Romance" },
  { title: "The Notebook",                     author: "Nicholas Sparks",           year: 1996, pages: 214,  type: "Fiction",     genre: "Romance" },
  { title: "A Walk to Remember",              author: "Nicholas Sparks",           year: 1999, pages: 240,  type: "Fiction",     genre: "Romance" },
  { title: "The Lucky One",                   author: "Nicholas Sparks",           year: 2008, pages: 368,  type: "Fiction",     genre: "Romance" },
  { title: "Me Before You",                   author: "Jojo Moyes",                year: 2012, pages: 369,  type: "Fiction",     genre: "Romance" },
  { title: "After You",                       author: "Jojo Moyes",                year: 2015, pages: 370,  type: "Fiction",     genre: "Romance" },
  { title: "Still Me",                        author: "Jojo Moyes",                year: 2018, pages: 400,  type: "Fiction",     genre: "Romance" },
  { title: "The Hating Game",                 author: "Sally Thorne",              year: 2016, pages: 381,  type: "Fiction",     genre: "Romance" },
  { title: "Beach Read",                      author: "Emily Henry",               year: 2020, pages: 361,  type: "Fiction",     genre: "Romance" },
  { title: "People We Meet on Vacation",       author: "Emily Henry",               year: 2021, pages: 361,  type: "Fiction",     genre: "Romance" },
  { title: "Book Lovers",                     author: "Emily Henry",               year: 2022, pages: 373,  type: "Fiction",     genre: "Romance" },
  { title: "Happy Place",                     author: "Emily Henry",               year: 2023, pages: 400,  type: "Fiction",     genre: "Romance" },
  { title: "The Kiss Quotient",               author: "Helen Hoang",               year: 2018, pages: 336,  type: "Fiction",     genre: "Romance" },
  { title: "It Ends with Us",                 author: "Colleen Hoover",            year: 2016, pages: 301,  type: "Fiction",     genre: "Romance" },
  { title: "Ugly Love",                       author: "Colleen Hoover",            year: 2014, pages: 323,  type: "Fiction",     genre: "Romance" },
  { title: "Verity",                          author: "Colleen Hoover",            year: 2018, pages: 336,  type: "Fiction",     genre: "Thriller" },
  { title: "November 9",                      author: "Colleen Hoover",            year: 2015, pages: 310,  type: "Fiction",     genre: "Romance" },
  { title: "Reminders of Him",                author: "Colleen Hoover",            year: 2022, pages: 335,  type: "Fiction",     genre: "Romance" },
  { title: "The Spanish Love Deception",       author: "Elena Armas",               year: 2021, pages: 430,  type: "Fiction",     genre: "Romance" },
  { title: "The American Roommate Experiment", author: "Elena Armas",               year: 2022, pages: 416,  type: "Fiction",     genre: "Romance" },
  { title: "Icebreaker",                      author: "Hannah Grace",              year: 2022, pages: 431,  type: "Fiction",     genre: "Romance" },
  { title: "Things We Never Got Over",         author: "Lucy Score",                year: 2022, pages: 543,  type: "Fiction",     genre: "Romance" },
  { title: "The Love Hypothesis",             author: "Ali Hazelwood",             year: 2021, pages: 356,  type: "Fiction",     genre: "Romance" },
  // ── Historical Fiction ────────────────────────────────────────────────────
  { title: "The Pillars of the Earth",         author: "Ken Follett",               year: 1989, pages: 973,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "World Without End",               author: "Ken Follett",               year: 2007, pages: 1014, type: "Fiction",     genre: "Historical Fiction" },
  { title: "The Other Boleyn Girl",            author: "Philippa Gregory",          year: 2001, pages: 664,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Wolf Hall",                        author: "Hilary Mantel",             year: 2009, pages: 532,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Bring Up the Bodies",              author: "Hilary Mantel",             year: 2012, pages: 352,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "The Mirror & the Light",           author: "Hilary Mantel",             year: 2020, pages: 784,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "The Bronze Horseman",              author: "Paullina Simons",           year: 2000, pages: 848,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "All Quiet on the Western Front",   author: "Erich Maria Remarque",      year: 1929, pages: 296,  type: "Fiction",     genre: "War" },
  { title: "Catch-22",                         author: "Joseph Heller",             year: 1961, pages: 453,  type: "Fiction",     genre: "War" },
  { title: "The Kite Runner",                  author: "Khaled Hosseini",           year: 2003, pages: 371,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "A Thousand Splendid Suns",         author: "Khaled Hosseini",           year: 2007, pages: 372,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "And the Mountains Echoed",         author: "Khaled Hosseini",           year: 2013, pages: 404,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Book Thief",                   author: "Markus Zusak",              year: 2005, pages: 552,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Night",                            author: "Elie Wiesel",               year: 1960, pages: 120,  type: "Non-Fiction", genre: "Memoir" },
  { title: "The Diary of a Young Girl",        author: "Anne Frank",                year: 1947, pages: 283,  type: "Non-Fiction", genre: "Memoir" },
  { title: "Maus",                             author: "Art Spiegelman",            year: 1991, pages: 296,  type: "Non-Fiction", genre: "Graphic Novel" },
  { title: "The Boy in the Striped Pyjamas",   author: "John Boyne",                year: 2006, pages: 216,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Schindler's Ark",                  author: "Thomas Keneally",           year: 1982, pages: 560,  type: "Non-Fiction", genre: "Historical" },
  { title: "Pachinko",                         author: "Min Jin Lee",               year: 2017, pages: 490,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "The Remains of the Day",           author: "Kazuo Ishiguro",            year: 1989, pages: 258,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "An Artist of the Floating World",  author: "Kazuo Ishiguro",            year: 1986, pages: 208,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Lincoln in the Bardo",             author: "George Saunders",           year: 2017, pages: 343,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Roots",                            author: "Alex Haley",                year: 1976, pages: 729,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Cold Mountain",                    author: "Charles Frazier",           year: 1997, pages: 449,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "All the Light We Cannot See",      author: "Anthony Doerr",             year: 2014, pages: 531,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "The Alice Network",                author: "Kate Quinn",                year: 2017, pages: 502,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "The Tattooist of Auschwitz",        author: "Heather Morris",            year: 2018, pages: 257,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "The Huntress",                     author: "Kate Quinn",                year: 2019, pages: 560,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Birdsong",                         author: "Sebastian Faulks",          year: 1993, pages: 503,  type: "Fiction",     genre: "War" },
  // ── Contemporary & Literary ────────────────────────────────────────────────
  { title: "White Noise",                      author: "Don DeLillo",               year: 1985, pages: 310,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Underworld",                       author: "Don DeLillo",               year: 1997, pages: 827,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Infinite Jest",                    author: "David Foster Wallace",      year: 1996, pages: 1079, type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Corrections",                  author: "Jonathan Franzen",          year: 2001, pages: 568,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Freedom",                          author: "Jonathan Franzen",          year: 2010, pages: 562,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Crossroads",                       author: "Jonathan Franzen",          year: 2021, pages: 592,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Virgin Suicides",              author: "Jeffrey Eugenides",         year: 1993, pages: 249,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Middlesex",                        author: "Jeffrey Eugenides",         year: 2002, pages: 529,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Marriage Plot",               author: "Jeffrey Eugenides",         year: 2011, pages: 406,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Atonement",                        author: "Ian McEwan",                year: 2001, pages: 351,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Saturday",                         author: "Ian McEwan",                year: 2005, pages: 289,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Amsterdam",                        author: "Ian McEwan",                year: 1998, pages: 193,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "On Chesil Beach",                  author: "Ian McEwan",                year: 2007, pages: 166,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Normal People",                    author: "Sally Rooney",              year: 2018, pages: 273,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Conversations with Friends",        author: "Sally Rooney",              year: 2017, pages: 321,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Beautiful World, Where Are You",   author: "Sally Rooney",              year: 2021, pages: 356,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "A Little Life",                    author: "Hanya Yanagihara",          year: 2015, pages: 720,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "To Paradise",                      author: "Hanya Yanagihara",          year: 2022, pages: 720,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Secret History",              author: "Donna Tartt",               year: 1992, pages: 524,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Goldfinch",                   author: "Donna Tartt",               year: 2013, pages: 771,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Little Friend",               author: "Donna Tartt",               year: 2002, pages: 555,  type: "Fiction",     genre: "Mystery" },
  { title: "Eleanor Oliphant Is Completely Fine", author: "Gail Honeyman",           year: 2017, pages: 327,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Where the Crawdads Sing",          author: "Delia Owens",              year: 2018, pages: 370,  type: "Fiction",     genre: "Mystery" },
  { title: "A Man Called Ove",                 author: "Fredrik Backman",           year: 2012, pages: 337,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Anxious People",                   author: "Fredrik Backman",           year: 2019, pages: 341,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Beartown",                         author: "Fredrik Backman",           year: 2016, pages: 432,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Seven Husbands of Evelyn Hugo", author: "Taylor Jenkins Reid",       year: 2017, pages: 400,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Daisy Jones and the Six",          author: "Taylor Jenkins Reid",       year: 2019, pages: 368,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Malibu Rising",                    author: "Taylor Jenkins Reid",       year: 2021, pages: 384,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Carrie Soto Is Back",              author: "Taylor Jenkins Reid",       year: 2022, pages: 384,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Midnight Library",             author: "Matt Haig",                 year: 2020, pages: 288,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Reasons to Stay Alive",           author: "Matt Haig",                 year: 2015, pages: 256,  type: "Non-Fiction", genre: "Memoir" },
  { title: "The House in the Cerulean Sea",    author: "TJ Klune",                  year: 2020, pages: 394,  type: "Fiction",     genre: "Fantasy" },
  { title: "Tomorrow, and Tomorrow, and Tomorrow", author: "Gabrielle Zevin",        year: 2022, pages: 416,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Demon Copperhead",                 author: "Barbara Kingsolver",        year: 2022, pages: 548,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Poisonwood Bible",             author: "Barbara Kingsolver",        year: 1998, pages: 546,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Prodigal Summer",                  author: "Barbara Kingsolver",        year: 2000, pages: 444,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Glass Menagerie",              author: "Tennessee Williams",        year: 1944, pages: 115,  type: "Fiction",     genre: "Drama" },
  { title: "A Streetcar Named Desire",         author: "Tennessee Williams",        year: 1947, pages: 107,  type: "Fiction",     genre: "Drama" },
  { title: "Death of a Salesman",              author: "Arthur Miller",             year: 1949, pages: 136,  type: "Fiction",     genre: "Drama" },
  { title: "The Crucible",                     author: "Arthur Miller",             year: 1953, pages: 143,  type: "Fiction",     genre: "Drama" },
  { title: "East of Eden",                     author: "John Steinbeck",            year: 1952, pages: 601,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Cannery Row",                      author: "John Steinbeck",            year: 1945, pages: 208,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Pearl",                        author: "John Steinbeck",            year: 1947, pages: 90,   type: "Fiction",     genre: "Literary Fiction" },
  { title: "Interpreter of Maladies",          author: "Jhumpa Lahiri",             year: 1999, pages: 198,  type: "Fiction",     genre: "Short Stories" },
  { title: "The Namesake",                     author: "Jhumpa Lahiri",             year: 2003, pages: 291,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Unaccustomed Earth",               author: "Jhumpa Lahiri",             year: 2008, pages: 333,  type: "Fiction",     genre: "Short Stories" },
  { title: "The God of Small Things",          author: "Arundhati Roy",             year: 1997, pages: 321,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Midnight's Children",              author: "Salman Rushdie",            year: 1981, pages: 647,  type: "Fiction",     genre: "Magical Realism" },
  { title: "The Satanic Verses",               author: "Salman Rushdie",            year: 1988, pages: 561,  type: "Fiction",     genre: "Magical Realism" },
  { title: "The White Tiger",                  author: "Aravind Adiga",             year: 2008, pages: 321,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Shantaram",                        author: "Gregory David Roberts",     year: 2003, pages: 933,  type: "Fiction",     genre: "Adventure" },
  { title: "The English Patient",              author: "Michael Ondaatje",          year: 1992, pages: 307,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Life of Pi",                       author: "Yann Martel",               year: 2001, pages: 319,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Alchemist",                    author: "Paulo Coelho",              year: 1988, pages: 197,  type: "Fiction",     genre: "Philosophical" },
  { title: "Veronika Decides to Die",          author: "Paulo Coelho",              year: 1998, pages: 210,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Eleven Minutes",                   author: "Paulo Coelho",              year: 2003, pages: 290,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Zahir",                        author: "Paulo Coelho",              year: 2005, pages: 336,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Brida",                            author: "Paulo Coelho",              year: 1990, pages: 200,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Valkyries",                    author: "Paulo Coelho",              year: 1992, pages: 256,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "The Fifth Mountain",               author: "Paulo Coelho",              year: 1996, pages: 256,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Perfume",                          author: "Patrick Süskind",           year: 1985, pages: 255,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Captain Corelli's Mandolin",       author: "Louis de Bernières",        year: 1994, pages: 537,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "The Lacuna",                       author: "Barbara Kingsolver",        year: 2009, pages: 507,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "City of Thieves",                  author: "David Benioff",             year: 2008, pages: 258,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "The Pillars of the Earth",         author: "Ken Follett",               year: 1989, pages: 973,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Half of a Yellow Sun",             author: "Chimamanda Ngozi Adichie",  year: 2006, pages: 433,  type: "Fiction",     genre: "Historical Fiction" },
  { title: "Purple Hibiscus",                  author: "Chimamanda Ngozi Adichie",  year: 2003, pages: 307,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Americanah",                       author: "Chimamanda Ngozi Adichie",  year: 2013, pages: 477,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "We Should All Be Feminists",       author: "Chimamanda Ngozi Adichie",  year: 2014, pages: 64,   type: "Non-Fiction", genre: "Social Commentary" },
  { title: "Things Fall Apart",                author: "Chinua Achebe",             year: 1958, pages: 209,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Arrow of God",                     author: "Chinua Achebe",             year: 1964, pages: 287,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Season of Migration to the North", author: "Tayeb Salih",               year: 1966, pages: 139,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Disgrace",                         author: "J.M. Coetzee",              year: 1999, pages: 220,  type: "Fiction",     genre: "Literary Fiction" },
  { title: "Waiting for the Barbarians",       author: "J.M. Coetzee",              year: 1980, pages: 156,  type: "Fiction",     genre: "Literary Fiction" },
  // ── Young Adult ───────────────────────────────────────────────────────────
  { title: "The Hunger Games",                 author: "Suzanne Collins",           year: 2008, pages: 374,  type: "Fiction",     genre: "Dystopian" },
  { title: "Catching Fire",                    author: "Suzanne Collins",           year: 2009, pages: 391,  type: "Fiction",     genre: "Dystopian" },
  { title: "Mockingjay",                       author: "Suzanne Collins",           year: 2010, pages: 390,  type: "Fiction",     genre: "Dystopian" },
  { title: "The Ballad of Songbirds and Snakes",author: "Suzanne Collins",           year: 2020, pages: 517,  type: "Fiction",     genre: "Dystopian" },
  { title: "Divergent",                        author: "Veronica Roth",             year: 2011, pages: 487,  type: "Fiction",     genre: "Dystopian" },
  { title: "Insurgent",                        author: "Veronica Roth",             year: 2012, pages: 525,  type: "Fiction",     genre: "Dystopian" },
  { title: "Allegiant",                        author: "Veronica Roth",             year: 2013, pages: 526,  type: "Fiction",     genre: "Dystopian" },
  { title: "The Maze Runner",                  author: "James Dashner",             year: 2009, pages: 375,  type: "Fiction",     genre: "Dystopian" },
  { title: "The Scorch Trials",                author: "James Dashner",             year: 2010, pages: 360,  type: "Fiction",     genre: "Dystopian" },
  { title: "The Death Cure",                   author: "James Dashner",             year: 2011, pages: 324,  type: "Fiction",     genre: "Dystopian" },
  { title: "The Fault in Our Stars",           author: "John Green",                year: 2012, pages: 313,  type: "Fiction",     genre: "Romance" },
  { title: "Looking for Alaska",               author: "John Green",                year: 2005, pages: 221,  type: "Fiction",     genre: "Young Adult" },
  { title: "An Abundance of Katherines",       author: "John Green",                year: 2006, pages: 227,  type: "Fiction",     genre: "Young Adult" },
  { title: "Paper Towns",                      author: "John Green",                year: 2008, pages: 305,  type: "Fiction",     genre: "Young Adult" },
  { title: "Turtles All the Way Down",         author: "John Green",                year: 2017, pages: 286,  type: "Fiction",     genre: "Young Adult" },
  { title: "The Perks of Being a Wallflower",  author: "Stephen Chbosky",           year: 1999, pages: 213,  type: "Fiction",     genre: "Young Adult" },
  { title: "Wonder",                           author: "R.J. Palacio",              year: 2012, pages: 315,  type: "Fiction",     genre: "Young Adult" },
  { title: "Speak",                            author: "Laurie Halse Anderson",     year: 1999, pages: 198,  type: "Fiction",     genre: "Young Adult" },
  { title: "The Outsiders",                    author: "S.E. Hinton",               year: 1967, pages: 192,  type: "Fiction",     genre: "Young Adult" },
  { title: "Flowers in the Attic",             author: "V.C. Andrews",              year: 1979, pages: 411,  type: "Fiction",     genre: "Gothic" },
  { title: "Twilight",                         author: "Stephenie Meyer",           year: 2005, pages: 498,  type: "Fiction",     genre: "Romance" },
  { title: "New Moon",                         author: "Stephenie Meyer",           year: 2006, pages: 563,  type: "Fiction",     genre: "Romance" },
  { title: "Eclipse",                          author: "Stephenie Meyer",           year: 2007, pages: 629,  type: "Fiction",     genre: "Romance" },
  { title: "Breaking Dawn",                    author: "Stephenie Meyer",           year: 2008, pages: 756,  type: "Fiction",     genre: "Romance" },
  { title: "City of Bones",                    author: "Cassandra Clare",           year: 2007, pages: 485,  type: "Fiction",     genre: "Fantasy" },
  { title: "City of Ashes",                    author: "Cassandra Clare",           year: 2008, pages: 453,  type: "Fiction",     genre: "Fantasy" },
  { title: "City of Glass",                    author: "Cassandra Clare",           year: 2009, pages: 541,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Maze Runner",                  author: "James Dashner",             year: 2009, pages: 375,  type: "Fiction",     genre: "Dystopian" },
  { title: "Miss Peregrine's Home for Peculiar Children", author: "Ransom Riggs",   year: 2011, pages: 352,  type: "Fiction",     genre: "Fantasy" },
  { title: "The Selection",                    author: "Kiera Cass",                year: 2012, pages: 327,  type: "Fiction",     genre: "Dystopian" },
  { title: "The Elite",                        author: "Kiera Cass",                year: 2013, pages: 336,  type: "Fiction",     genre: "Dystopian" },
  { title: "The One",                          author: "Kiera Cass",                year: 2014, pages: 323,  type: "Fiction",     genre: "Dystopian" },
  // ── Non-Fiction: Self-Help & Personal Development ─────────────────────────
  { title: "Atomic Habits",                    author: "James Clear",               year: 2018, pages: 320,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "The 7 Habits of Highly Effective People", author: "Stephen R. Covey",   year: 1989, pages: 432,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "How to Win Friends and Influence People", author: "Dale Carnegie",      year: 1936, pages: 291,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Think and Grow Rich",              author: "Napoleon Hill",             year: 1937, pages: 238,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "The Power of Now",                 author: "Eckhart Tolle",             year: 1997, pages: 229,  type: "Non-Fiction", genre: "Spirituality" },
  { title: "A New Earth",                      author: "Eckhart Tolle",             year: 2005, pages: 309,  type: "Non-Fiction", genre: "Spirituality" },
  { title: "The Four Agreements",              author: "Don Miguel Ruiz",           year: 1997, pages: 160,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Man's Search for Meaning",         author: "Viktor E. Frankl",          year: 1946, pages: 165,  type: "Non-Fiction", genre: "Memoir" },
  { title: "The Subtle Art of Not Giving a F*ck", author: "Mark Manson",            year: 2016, pages: 212,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Everything Is F*cked",             author: "Mark Manson",               year: 2019, pages: 256,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Thinking, Fast and Slow",          author: "Daniel Kahneman",           year: 2011, pages: 499,  type: "Non-Fiction", genre: "Psychology" },
  { title: "Influence",                        author: "Robert B. Cialdini",        year: 1984, pages: 320,  type: "Non-Fiction", genre: "Psychology" },
  { title: "Pre-Suasion",                      author: "Robert B. Cialdini",        year: 2016, pages: 432,  type: "Non-Fiction", genre: "Psychology" },
  { title: "Blink",                            author: "Malcolm Gladwell",          year: 2005, pages: 296,  type: "Non-Fiction", genre: "Psychology" },
  { title: "The Tipping Point",               author: "Malcolm Gladwell",          year: 2000, pages: 301,  type: "Non-Fiction", genre: "Psychology" },
  { title: "Outliers",                         author: "Malcolm Gladwell",          year: 2008, pages: 309,  type: "Non-Fiction", genre: "Psychology" },
  { title: "David and Goliath",               author: "Malcolm Gladwell",          year: 2013, pages: 305,  type: "Non-Fiction", genre: "Psychology" },
  { title: "Talking to Strangers",             author: "Malcolm Gladwell",          year: 2019, pages: 400,  type: "Non-Fiction", genre: "Psychology" },
  { title: "The Revisionist History",          author: "Malcolm Gladwell",          year: 2016, pages: 320,  type: "Non-Fiction", genre: "Psychology" },
  { title: "Grit",                             author: "Angela Duckworth",          year: 2016, pages: 333,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Mindset",                          author: "Carol S. Dweck",            year: 2006, pages: 276,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Drive",                            author: "Daniel H. Pink",            year: 2009, pages: 242,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "To Sell Is Human",                author: "Daniel H. Pink",            year: 2012, pages: 272,  type: "Non-Fiction", genre: "Business" },
  { title: "When",                             author: "Daniel H. Pink",            year: 2018, pages: 272,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Deep Work",                        author: "Cal Newport",               year: 2016, pages: 296,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Digital Minimalism",               author: "Cal Newport",               year: 2019, pages: 302,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "So Good They Can't Ignore You",    author: "Cal Newport",               year: 2012, pages: 304,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "The One Thing",                    author: "Gary Keller",               year: 2013, pages: 240,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Essentialism",                     author: "Greg McKeown",              year: 2014, pages: 272,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "The 4-Hour Workweek",              author: "Timothy Ferriss",           year: 2007, pages: 308,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Tools of Titans",                  author: "Timothy Ferriss",           year: 2016, pages: 736,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Tribe of Mentors",                 author: "Timothy Ferriss",           year: 2017, pages: 624,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "The Lean Startup",                 author: "Eric Ries",                 year: 2011, pages: 336,  type: "Non-Fiction", genre: "Business" },
  { title: "Zero to One",                      author: "Peter Thiel",               year: 2014, pages: 195,  type: "Non-Fiction", genre: "Business" },
  { title: "Good to Great",                    author: "Jim Collins",               year: 2001, pages: 300,  type: "Non-Fiction", genre: "Business" },
  { title: "Built to Last",                    author: "Jim Collins",               year: 1994, pages: 342,  type: "Non-Fiction", genre: "Business" },
  { title: "The E-Myth Revisited",             author: "Michael E. Gerber",         year: 1995, pages: 288,  type: "Non-Fiction", genre: "Business" },
  { title: "Start with Why",                   author: "Simon Sinek",               year: 2009, pages: 256,  type: "Non-Fiction", genre: "Business" },
  { title: "Leaders Eat Last",                 author: "Simon Sinek",               year: 2014, pages: 256,  type: "Non-Fiction", genre: "Business" },
  { title: "The Infinite Game",               author: "Simon Sinek",               year: 2019, pages: 272,  type: "Non-Fiction", genre: "Business" },
  { title: "Never Split the Difference",       author: "Chris Voss",                year: 2016, pages: 288,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Getting Things Done",              author: "David Allen",               year: 2001, pages: 267,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "The Power of Habit",               author: "Charles Duhigg",            year: 2012, pages: 371,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Smarter Faster Better",            author: "Charles Duhigg",            year: 2016, pages: 400,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Willpower",                        author: "Roy F. Baumeister",         year: 2011, pages: 291,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "The Willpower Instinct",           author: "Kelly McGonigal",           year: 2011, pages: 275,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "The Artist's Way",                 author: "Julia Cameron",             year: 1992, pages: 222,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Big Magic",                        author: "Elizabeth Gilbert",         year: 2015, pages: 273,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Eat Pray Love",                    author: "Elizabeth Gilbert",         year: 2006, pages: 334,  type: "Non-Fiction", genre: "Memoir" },
  { title: "The Body Keeps the Score",         author: "Bessel van der Kolk",       year: 2014, pages: 464,  type: "Non-Fiction", genre: "Psychology" },
  { title: "Maybe You Should Talk to Someone", author: "Lori Gottlieb",             year: 2019, pages: 432,  type: "Non-Fiction", genre: "Psychology" },
  { title: "The Coddling of the American Mind",author: "Greg Lukianoff",            year: 2018, pages: 352,  type: "Non-Fiction", genre: "Social Commentary" },
  { title: "12 Rules for Life",               author: "Jordan B. Peterson",        year: 2018, pages: 448,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Beyond Order",                    author: "Jordan B. Peterson",        year: 2021, pages: 432,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Maps of Meaning",                  author: "Jordan B. Peterson",        year: 1999, pages: 564,  type: "Non-Fiction", genre: "Psychology" },
  { title: "Can't Hurt Me",                   author: "David Goggins",             year: 2018, pages: 364,  type: "Non-Fiction", genre: "Memoir" },
  { title: "Extreme Ownership",                author: "Jocko Willink",             year: 2015, pages: 320,  type: "Non-Fiction", genre: "Self-Help" },
  { title: "Discipline Equals Freedom",        author: "Jocko Willink",             year: 2017, pages: 256,  type: "Non-Fiction", genre: "Self-Help" },
  // ── Non-Fiction: Science & Nature ─────────────────────────────────────────
  { title: "A Brief History of Time",          author: "Stephen Hawking",           year: 1988, pages: 212,  type: "Non-Fiction", genre: "Science" },
  { title: "The Grand Design",                 author: "Stephen Hawking",           year: 2010, pages: 208,  type: "Non-Fiction", genre: "Science" },
  { title: "Black Holes and Baby Universes",   author: "Stephen Hawking",           year: 1993, pages: 182,  type: "Non-Fiction", genre: "Science" },
  { title: "The Selfish Gene",                 author: "Richard Dawkins",           year: 1976, pages: 360,  type: "Non-Fiction", genre: "Science" },
  { title: "The God Delusion",                 author: "Richard Dawkins",           year: 2006, pages: 406,  type: "Non-Fiction", genre: "Science" },
  { title: "The Blind Watchmaker",             author: "Richard Dawkins",           year: 1986, pages: 332,  type: "Non-Fiction", genre: "Science" },
  { title: "Cosmos",                           author: "Carl Sagan",                year: 1980, pages: 365,  type: "Non-Fiction", genre: "Science" },
  { title: "The Demon-Haunted World",          author: "Carl Sagan",                year: 1995, pages: 457,  type: "Non-Fiction", genre: "Science" },
  { title: "Pale Blue Dot",                    author: "Carl Sagan",                year: 1994, pages: 429,  type: "Non-Fiction", genre: "Science" },
  { title: "Astrophysics for People in a Hurry", author: "Neil deGrasse Tyson",     year: 2017, pages: 222,  type: "Non-Fiction", genre: "Science" },
  { title: "Death by Black Hole",              author: "Neil deGrasse Tyson",       year: 2007, pages: 384,  type: "Non-Fiction", genre: "Science" },
  { title: "The Feynman Lectures on Physics",  author: "Richard Feynman",           year: 1964, pages: 1552, type: "Non-Fiction", genre: "Science" },
  { title: "Surely You're Joking, Mr. Feynman!", author: "Richard Feynman",          year: 1985, pages: 350,  type: "Non-Fiction", genre: "Memoir" },
  { title: "QED",                              author: "Richard Feynman",           year: 1985, pages: 158,  type: "Non-Fiction", genre: "Science" },
  { title: "The Origin of Species",            author: "Charles Darwin",            year: 1859, pages: 502,  type: "Non-Fiction", genre: "Science" },
  { title: "The Double Helix",                 author: "James D. Watson",           year: 1968, pages: 240,  type: "Non-Fiction", genre: "Memoir" },
  { title: "The Gene",                         author: "Siddhartha Mukherjee",      year: 2016, pages: 592,  type: "Non-Fiction", genre: "Science" },
  { title: "The Emperor of All Maladies",      author: "Siddhartha Mukherjee",      year: 2010, pages: 571,  type: "Non-Fiction", genre: "Science" },
  { title: "The Spirit Catches You and You Fall Down", author: "Anne Fadiman",       year: 1997, pages: 352,  type: "Non-Fiction", genre: "Science" },
  { title: "Behave",                           author: "Robert M. Sapolsky",        year: 2017, pages: 790,  type: "Non-Fiction", genre: "Science" },
  { title: "Why Zebras Don't Get Ulcers",      author: "Robert M. Sapolsky",        year: 1994, pages: 560,  type: "Non-Fiction", genre: "Science" },
  { title: "The Brain That Changes Itself",    author: "Norman Doidge",             year: 2007, pages: 427,  type: "Non-Fiction", genre: "Science" },
  { title: "How the Mind Works",               author: "Steven Pinker",             year: 1997, pages: 660,  type: "Non-Fiction", genre: "Science" },
  { title: "The Language Instinct",            author: "Steven Pinker",             year: 1994, pages: 525,  type: "Non-Fiction", genre: "Science" },
  { title: "Enlightenment Now",                author: "Steven Pinker",             year: 2018, pages: 556,  type: "Non-Fiction", genre: "Science" },
  { title: "The Better Angels of Our Nature",  author: "Steven Pinker",             year: 2011, pages: 832,  type: "Non-Fiction", genre: "Science" },
  { title: "Guns, Germs, and Steel",           author: "Jared Diamond",             year: 1997, pages: 498,  type: "Non-Fiction", genre: "History" },
  { title: "The Third Chimpanzee",             author: "Jared Diamond",             year: 1991, pages: 407,  type: "Non-Fiction", genre: "Science" },
  { title: "Collapse",                         author: "Jared Diamond",             year: 2005, pages: 575,  type: "Non-Fiction", genre: "History" },
  { title: "The Sixth Extinction",             author: "Elizabeth Kolbert",         year: 2014, pages: 319,  type: "Non-Fiction", genre: "Science" },
  { title: "Silent Spring",                    author: "Rachel Carson",             year: 1962, pages: 368,  type: "Non-Fiction", genre: "Science" },
  { title: "The Sea Around Us",               author: "Rachel Carson",             year: 1951, pages: 237,  type: "Non-Fiction", genre: "Science" },
  { title: "The Hot Zone",                     author: "Richard Preston",           year: 1994, pages: 422,  type: "Non-Fiction", genre: "Science" },
  { title: "Spillover",                        author: "David Quammen",             year: 2012, pages: 608,  type: "Non-Fiction", genre: "Science" },
  { title: "The Immortal Life of Henrietta Lacks", author: "Rebecca Skloot",        year: 2010, pages: 381,  type: "Non-Fiction", genre: "Science" },
  { title: "Stiff",                            author: "Mary Roach",                year: 2003, pages: 303,  type: "Non-Fiction", genre: "Science" },
  { title: "Packing for Mars",                 author: "Mary Roach",                year: 2010, pages: 334,  type: "Non-Fiction", genre: "Science" },
  { title: "The Disappearing Spoon",           author: "Sam Kean",                  year: 2010, pages: 391,  type: "Non-Fiction", genre: "Science" },
  // ── Non-Fiction: History & Social Science ─────────────────────────────────
  { title: "Sapiens",                          author: "Yuval Noah Harari",         year: 2011, pages: 443,  type: "Non-Fiction", genre: "History" },
  { title: "Homo Deus",                        author: "Yuval Noah Harari",         year: 2015, pages: 450,  type: "Non-Fiction", genre: "History" },
  { title: "21 Lessons for the 21st Century",  author: "Yuval Noah Harari",         year: 2018, pages: 352,  type: "Non-Fiction", genre: "History" },
  { title: "Nexus",                            author: "Yuval Noah Harari",         year: 2024, pages: 528,  type: "Non-Fiction", genre: "History" },
  { title: "The Rise and Fall of the Third Reich", author: "William L. Shirer",     year: 1960, pages: 1249, type: "Non-Fiction", genre: "History" },
  { title: "The Second World War",             author: "Winston Churchill",         year: 1948, pages: 3000, type: "Non-Fiction", genre: "History" },
  { title: "The Art of War",                   author: "Sun Tzu",                   year: -500, pages: 273,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "The Republic",                     author: "Plato",                     year: -380, pages: 416,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "The Nicomachean Ethics",           author: "Aristotle",                 year: -350, pages: 352,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "Meditations",                      author: "Marcus Aurelius",           year: 170,  pages: 254,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "The Confessions",                  author: "Saint Augustine",           year: 400,  pages: 342,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "The Prince",                       author: "Niccolò Machiavelli",       year: 1532, pages: 140,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "Leviathan",                        author: "Thomas Hobbes",             year: 1651, pages: 736,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "A Treatise of Human Nature",       author: "David Hume",                year: 1739, pages: 638,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "Critique of Pure Reason",          author: "Immanuel Kant",             year: 1781, pages: 784,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "On the Origin of Species",         author: "Charles Darwin",            year: 1859, pages: 502,  type: "Non-Fiction", genre: "Science" },
  { title: "The Wealth of Nations",            author: "Adam Smith",                year: 1776, pages: 1264, type: "Non-Fiction", genre: "Economics" },
  { title: "Das Kapital",                      author: "Karl Marx",                 year: 1867, pages: 1152, type: "Non-Fiction", genre: "Economics" },
  { title: "The Communist Manifesto",          author: "Karl Marx",                 year: 1848, pages: 96,   type: "Non-Fiction", genre: "Philosophy" },
  { title: "On Liberty",                       author: "John Stuart Mill",          year: 1859, pages: 130,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "The Interpretation of Dreams",     author: "Sigmund Freud",             year: 1899, pages: 752,  type: "Non-Fiction", genre: "Psychology" },
  { title: "The Social Contract",              author: "Jean-Jacques Rousseau",     year: 1762, pages: 168,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "Beyond Good and Evil",             author: "Friedrich Nietzsche",       year: 1886, pages: 240,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "Thus Spoke Zarathustra",           author: "Friedrich Nietzsche",       year: 1883, pages: 352,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "The Will to Power",                author: "Friedrich Nietzsche",       year: 1901, pages: 576,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "Being and Nothingness",            author: "Jean-Paul Sartre",          year: 1943, pages: 638,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "The Second Sex",                   author: "Simone de Beauvoir",        year: 1949, pages: 800,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "The Feminine Mystique",            author: "Betty Friedan",             year: 1963, pages: 512,  type: "Non-Fiction", genre: "Social Commentary" },
  { title: "The Bell Curve",                   author: "Richard J. Herrnstein",     year: 1994, pages: 875,  type: "Non-Fiction", genre: "Social Commentary" },
  { title: "The Structure of Scientific Revolutions", author: "Thomas S. Kuhn",     year: 1962, pages: 264,  type: "Non-Fiction", genre: "Philosophy" },
  { title: "The Road to Serfdom",              author: "F.A. Hayek",                year: 1944, pages: 274,  type: "Non-Fiction", genre: "Economics" },
  { title: "Freakonomics",                     author: "Steven D. Levitt",          year: 2005, pages: 315,  type: "Non-Fiction", genre: "Economics" },
  { title: "SuperFreakonomics",                author: "Steven D. Levitt",          year: 2009, pages: 270,  type: "Non-Fiction", genre: "Economics" },
  { title: "The Black Swan",                   author: "Nassim Nicholas Taleb",     year: 2007, pages: 400,  type: "Non-Fiction", genre: "Economics" },
  { title: "Antifragile",                      author: "Nassim Nicholas Taleb",     year: 2012, pages: 519,  type: "Non-Fiction", genre: "Economics" },
  { title: "Skin in the Game",                 author: "Nassim Nicholas Taleb",     year: 2018, pages: 304,  type: "Non-Fiction", genre: "Economics" },
  { title: "The Innovator's Dilemma",          author: "Clayton M. Christensen",    year: 1997, pages: 286,  type: "Non-Fiction", genre: "Business" },
  { title: "Creative Selection",               author: "Ken Kocienda",              year: 2018, pages: 272,  type: "Non-Fiction", genre: "Business" },
  { title: "Shoe Dog",                         author: "Phil Knight",               year: 2016, pages: 400,  type: "Non-Fiction", genre: "Memoir" },
  { title: "The Everything Store",             author: "Brad Stone",                year: 2013, pages: 384,  type: "Non-Fiction", genre: "Business" },
  { title: "Steve Jobs",                       author: "Walter Isaacson",           year: 2011, pages: 656,  type: "Non-Fiction", genre: "Biography" },
  { title: "Leonardo da Vinci",                author: "Walter Isaacson",           year: 2017, pages: 600,  type: "Non-Fiction", genre: "Biography" },
  { title: "Einstein: His Life and Universe",  author: "Walter Isaacson",           year: 2007, pages: 704,  type: "Non-Fiction", genre: "Biography" },
  { title: "Benjamin Franklin",                author: "Walter Isaacson",           year: 2003, pages: 608,  type: "Non-Fiction", genre: "Biography" },
  { title: "Elon Musk",                        author: "Walter Isaacson",           year: 2023, pages: 688,  type: "Non-Fiction", genre: "Biography" },
  { title: "Elon Musk",                        author: "Ashlee Vance",              year: 2015, pages: 400,  type: "Non-Fiction", genre: "Biography" },
  { title: "The Hard Thing About Hard Things", author: "Ben Horowitz",              year: 2014, pages: 304,  type: "Non-Fiction", genre: "Business" },
  { title: "Bad Blood",                        author: "John Carreyrou",            year: 2018, pages: 352,  type: "Non-Fiction", genre: "Business" },
  { title: "When Breath Becomes Air",          author: "Paul Kalanithi",            year: 2016, pages: 228,  type: "Non-Fiction", genre: "Memoir" },
  { title: "Being Mortal",                     author: "Atul Gawande",              year: 2014, pages: 282,  type: "Non-Fiction", genre: "Science" },
  { title: "The Checklist Manifesto",          author: "Atul Gawande",              year: 2009, pages: 209,  type: "Non-Fiction", genre: "Science" },
  { title: "Born a Crime",                     author: "Trevor Noah",               year: 2016, pages: 289,  type: "Non-Fiction", genre: "Memoir" },
  { title: "I Know Why the Caged Bird Sings",  author: "Maya Angelou",              year: 1969, pages: 289,  type: "Non-Fiction", genre: "Memoir" },
  { title: "The Glass Castle",                 author: "Jeannette Walls",           year: 2005, pages: 288,  type: "Non-Fiction", genre: "Memoir" },
  { title: "Educated",                         author: "Tara Westover",             year: 2018, pages: 334,  type: "Non-Fiction", genre: "Memoir" },
  { title: "Becoming",                         author: "Michelle Obama",            year: 2018, pages: 426,  type: "Non-Fiction", genre: "Memoir" },
  { title: "A Promised Land",                  author: "Barack Obama",              year: 2020, pages: 768,  type: "Non-Fiction", genre: "Memoir" },
  { title: "My Own Story",                     author: "Emmeline Pankhurst",        year: 1914, pages: 364,  type: "Non-Fiction", genre: "Memoir" },
  { title: "The Autobiography of Malcolm X",   author: "Malcolm X",                 year: 1965, pages: 527,  type: "Non-Fiction", genre: "Memoir" },
  { title: "Long Walk to Freedom",             author: "Nelson Mandela",            year: 1994, pages: 656,  type: "Non-Fiction", genre: "Memoir" },
  { title: "The Story of My Experiments with Truth", author: "Mahatma Gandhi",      year: 1927, pages: 504,  type: "Non-Fiction", genre: "Memoir" },
  { title: "Narrative of the Life of Frederick Douglass", author: "Frederick Douglass", year: 1845, pages: 107, type: "Non-Fiction", genre: "Memoir" },
  { title: "The Souls of Black Folk",          author: "W.E.B. Du Bois",           year: 1903, pages: 264,  type: "Non-Fiction", genre: "Social Commentary" },
  { title: "The New Jim Crow",                 author: "Michelle Alexander",        year: 2010, pages: 312,  type: "Non-Fiction", genre: "Social Commentary" },
  { title: "Between the World and Me",         author: "Ta-Nehisi Coates",          year: 2015, pages: 176,  type: "Non-Fiction", genre: "Social Commentary" },
  { title: "How to Be an Antiracist",          author: "Ibram X. Kendi",            year: 2019, pages: 320,  type: "Non-Fiction", genre: "Social Commentary" },
  { title: "White Fragility",                  author: "Robin DiAngelo",            year: 2018, pages: 192,  type: "Non-Fiction", genre: "Social Commentary" },
  { title: "The Warmth of Other Suns",         author: "Isabel Wilkerson",          year: 2010, pages: 622,  type: "Non-Fiction", genre: "History" },
  { title: "Caste",                            author: "Isabel Wilkerson",          year: 2020, pages: 496,  type: "Non-Fiction", genre: "Social Commentary" },
  { title: "Just Mercy",                       author: "Bryan Stevenson",           year: 2014, pages: 368,  type: "Non-Fiction", genre: "Social Commentary" },
  { title: "The Uninhabitable Earth",          author: "David Wallace-Wells",       year: 2019, pages: 310,  type: "Non-Fiction", genre: "Science" },
  { title: "This Changes Everything",          author: "Naomi Klein",               year: 2014, pages: 566,  type: "Non-Fiction", genre: "Social Commentary" },
  { title: "The Shock Doctrine",               author: "Naomi Klein",               year: 2007, pages: 558,  type: "Non-Fiction", genre: "Social Commentary" },
  // ── Graphic Novels ────────────────────────────────────────────────────────
  { title: "Watchmen",                         author: "Alan Moore",                year: 1987, pages: 416,  type: "Fiction",     genre: "Graphic Novel" },
  { title: "V for Vendetta",                   author: "Alan Moore",                year: 1988, pages: 296,  type: "Fiction",     genre: "Graphic Novel" },
  { title: "From Hell",                        author: "Alan Moore",                year: 1999, pages: 572,  type: "Fiction",     genre: "Graphic Novel" },
  { title: "The Sandman: Preludes & Nocturnes",author: "Neil Gaiman",               year: 1993, pages: 240,  type: "Fiction",     genre: "Graphic Novel" },
  { title: "Batman: The Dark Knight Returns",  author: "Frank Miller",              year: 1986, pages: 224,  type: "Fiction",     genre: "Graphic Novel" },
  { title: "Persepolis",                       author: "Marjane Satrapi",           year: 2000, pages: 160,  type: "Non-Fiction", genre: "Graphic Novel" },
  { title: "Fun Home",                         author: "Alison Bechdel",            year: 2006, pages: 240,  type: "Non-Fiction", genre: "Graphic Novel" },
  { title: "Are You My Mother?",               author: "Alison Bechdel",            year: 2012, pages: 286,  type: "Non-Fiction", genre: "Graphic Novel" },
  { title: "Saga, Vol. 1",                     author: "Brian K. Vaughan",          year: 2012, pages: 160,  type: "Fiction",     genre: "Graphic Novel" },
  { title: "Y: The Last Man",                  author: "Brian K. Vaughan",          year: 2002, pages: 1498, type: "Fiction",     genre: "Graphic Novel" },
  // ── Children's Classics ───────────────────────────────────────────────────
  { title: "The Little Prince",                author: "Antoine de Saint-Exupéry",  year: 1943, pages: 96,   type: "Fiction",     genre: "Children's" },
  { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll",             year: 1865, pages: 192,  type: "Fiction",     genre: "Children's" },
  { title: "Through the Looking-Glass",        author: "Lewis Carroll",             year: 1871, pages: 208,  type: "Fiction",     genre: "Children's" },
  { title: "Charlotte's Web",                  author: "E.B. White",                year: 1952, pages: 184,  type: "Fiction",     genre: "Children's" },
  { title: "Stuart Little",                    author: "E.B. White",                year: 1945, pages: 131,  type: "Fiction",     genre: "Children's" },
  { title: "The Wind in the Willows",          author: "Kenneth Grahame",           year: 1908, pages: 241,  type: "Fiction",     genre: "Children's" },
  { title: "Peter Pan",                        author: "J.M. Barrie",               year: 1911, pages: 192,  type: "Fiction",     genre: "Children's" },
  { title: "The Wonderful Wizard of Oz",       author: "L. Frank Baum",             year: 1900, pages: 259,  type: "Fiction",     genre: "Children's" },
  { title: "Anne of Green Gables",             author: "L.M. Montgomery",           year: 1908, pages: 320,  type: "Fiction",     genre: "Children's" },
  { title: "Black Beauty",                     author: "Anna Sewell",               year: 1877, pages: 255,  type: "Fiction",     genre: "Children's" },
  { title: "The Secret Garden",                author: "Frances Hodgson Burnett",   year: 1911, pages: 331,  type: "Fiction",     genre: "Children's" },
  { title: "A Little Princess",                author: "Frances Hodgson Burnett",   year: 1905, pages: 256,  type: "Fiction",     genre: "Children's" },
  { title: "Little Women",                     author: "Louisa May Alcott",         year: 1868, pages: 449,  type: "Fiction",     genre: "Children's" },
  { title: "Little Men",                       author: "Louisa May Alcott",         year: 1871, pages: 302,  type: "Fiction",     genre: "Children's" },
  { title: "The Jungle Book",                  author: "Rudyard Kipling",           year: 1894, pages: 212,  type: "Fiction",     genre: "Children's" },
  { title: "Just So Stories",                  author: "Rudyard Kipling",           year: 1902, pages: 230,  type: "Fiction",     genre: "Children's" },
  { title: "Where the Wild Things Are",        author: "Maurice Sendak",            year: 1963, pages: 48,   type: "Fiction",     genre: "Children's" },
  { title: "Goodnight Moon",                   author: "Margaret Wise Brown",       year: 1947, pages: 32,   type: "Fiction",     genre: "Children's" },
  { title: "Green Eggs and Ham",               author: "Dr. Seuss",                 year: 1960, pages: 62,   type: "Fiction",     genre: "Children's" },
  { title: "The Cat in the Hat",               author: "Dr. Seuss",                 year: 1957, pages: 61,   type: "Fiction",     genre: "Children's" },
  { title: "Oh, the Places You'll Go!",        author: "Dr. Seuss",                 year: 1990, pages: 56,   type: "Fiction",     genre: "Children's" },
  { title: "Charlie and the Chocolate Factory",author: "Roald Dahl",                year: 1964, pages: 196,  type: "Fiction",     genre: "Children's" },
  { title: "James and the Giant Peach",        author: "Roald Dahl",                year: 1961, pages: 146,  type: "Fiction",     genre: "Children's" },
  { title: "Matilda",                          author: "Roald Dahl",                year: 1988, pages: 232,  type: "Fiction",     genre: "Children's" },
  { title: "The BFG",                          author: "Roald Dahl",                year: 1982, pages: 219,  type: "Fiction",     genre: "Children's" },
  { title: "Danny the Champion of the World",  author: "Roald Dahl",                year: 1975, pages: 196,  type: "Fiction",     genre: "Children's" },
  { title: "The Witches",                      author: "Roald Dahl",                year: 1983, pages: 208,  type: "Fiction",     genre: "Children's" },
  { title: "Fantastic Mr Fox",                 author: "Roald Dahl",                year: 1970, pages: 96,   type: "Fiction",     genre: "Children's" },
  { title: "The Twits",                        author: "Roald Dahl",                year: 1980, pages: 80,   type: "Fiction",     genre: "Children's" },
  { title: "The Phantom Tollbooth",            author: "Norton Juster",             year: 1961, pages: 255,  type: "Fiction",     genre: "Children's" },
  { title: "A Wrinkle in Time",                author: "Madeleine L'Engle",         year: 1962, pages: 218,  type: "Fiction",     genre: "Children's" },
  { title: "Island of the Blue Dolphins",      author: "Scott O'Dell",              year: 1960, pages: 184,  type: "Fiction",     genre: "Children's" },
  { title: "The Phantom of the Opera",         author: "Gaston Leroux",             year: 1910, pages: 358,  type: "Fiction",     genre: "Gothic" },
];

// ─── De-duplicate by title ─────────────────────────────────────────────────────
const seen = new Set();
const UNIQUE_BOOKS = BOOKS.filter(b => {
  const key = b.title.toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// ─── Open Library: fetch cover + synopsis ─────────────────────────────────────
async function fetchBookMeta(title, author) {
  try {
    const query = encodeURIComponent(`${title} ${author}`);
    const res = await axios.get(
      `https://openlibrary.org/search.json?q=${query}&limit=1&fields=key,title,cover_i,first_publish_year,number_of_pages_median,first_sentence`,
      { timeout: 8000 }
    );
    const doc = res.data?.docs?.[0];
    if (!doc) return {};

    const coverUrl = doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
      : null;

    const synopsis = doc.first_sentence
      ? (typeof doc.first_sentence === 'object' ? doc.first_sentence.value : doc.first_sentence)
      : null;

    return { coverUrl, synopsis };
  } catch {
    return {};
  }
}

// ─── Get existing titles to skip duplicates ────────────────────────────────────
async function getExistingTitles() {
  const existing = new Set();
  let cursor;
  let hasMore = true;
  while (hasMore) {
    const res = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results) {
      for (const prop of Object.values(page.properties)) {
        if (prop.type === 'title' && prop.title?.length > 0) {
          existing.add(prop.title[0].plain_text.trim().toLowerCase());
        }
      }
    }
    hasMore = res.has_more;
    cursor = res.next_cursor;
  }
  return existing;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('====================================================');
  console.log('📚 Starting Books Library Import...');
  console.log(`   Total unique books in list: ${UNIQUE_BOOKS.length}`);
  console.log('====================================================\n');

  console.log('🔍 Fetching existing titles to skip duplicates...');
  const existing = await getExistingTitles();
  console.log(`   Found ${existing.size} existing entries.\n`);

  let imported = 0;
  let skipped  = 0;
  let failed   = 0;

  for (let i = 0; i < UNIQUE_BOOKS.length; i++) {
    const book = UNIQUE_BOOKS[i];
    const key  = book.title.toLowerCase();

    if (existing.has(key)) {
      console.log(`[${i + 1}/${UNIQUE_BOOKS.length}] ⚪ Skipping (exists): "${book.title}"`);
      skipped++;
      continue;
    }

    console.log(`[${i + 1}/${UNIQUE_BOOKS.length}] 📖 Importing: "${book.title}" by ${book.author}`);

    // Fetch cover + synopsis from Open Library
    const { coverUrl, synopsis } = await fetchBookMeta(book.title, book.author);
    if (coverUrl) console.log(`   🖼  Cover found: ${coverUrl}`);
    else          console.log(`   ⚠️  No cover found`);

    // Build page properties
    const properties = {
      Title:   { title: [{ text: { content: book.title } }] },
      Status:  { select: { name: 'Want to Read' } },
      Type:    { select: { name: book.type } },
      'Total Pages ': book.pages ? { number: book.pages } : { number: null },
    };

    // Cover via external URL (stored as external file)
    const cover = coverUrl
      ? { external: { url: coverUrl } }
      : null;

    // Build the page
    const pagePayload = {
      parent:     { database_id: DATABASE_ID },
      properties,
      cover:      cover || undefined,
    };

    // Add synopsis as page content if available
    const children = [];
    if (synopsis) {
      children.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: synopsis.slice(0, 2000) } }]
        }
      });
    }
    if (children.length > 0) pagePayload.children = children;

    // Retry logic for rate limiting
    let success = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await notion.pages.create(pagePayload);
        success = true;
        break;
      } catch (err) {
        if (err.code === 'rate_limited') {
          console.log(`   ⏳ Rate limited — waiting 60s (attempt ${attempt}/5)...`);
          await sleep(60000);
        } else {
          console.error(`   ❌ Error: ${err.message}`);
          break;
        }
      }
    }

    if (success) {
      console.log(`   \x1b[32m✅ Imported!\x1b[0m`);
      imported++;
    } else {
      failed++;
    }

    await sleep(700); // 700ms between requests to stay within Notion rate limits
  }

  console.log('\n====================================================');
  console.log('🎉 Books Import Complete!');
  console.log(`✅ Imported:  ${imported}`);
  console.log(`⚪ Skipped:   ${skipped} (already existed)`);
  console.log(`❌ Failed:    ${failed}`);
  console.log(`📚 Total processed: ${UNIQUE_BOOKS.length}`);
  console.log('====================================================\n');
}

run();
