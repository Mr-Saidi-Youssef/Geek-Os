const RECOMMENDATIONS_DATA = {
  movie: {
    trending: [
      {
        title: "Dune: Part Two",
        year: 2024,
        cover: "https://image.tmdb.org/t/p/w500/czembW0GXTzJ549770gh72e2y2n.jpg",
        synopsis: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
        genres: ["Sci-Fi", "Adventure", "Drama"],
        metadata: {
          director: "Denis Villeneuve",
          actors: "Timothée Chalamet, Zendaya, Rebecca Ferguson",
          writer: "Denis Villeneuve, Jon Spaihts",
          rating: 8.6,
          runtime: 166
        }
      },
      {
        title: "Oppenheimer",
        year: 2023,
        cover: "https://image.tmdb.org/t/p/w500/8Gxv2Z7HqD6hwRhWkq7zN2Jmznq.jpg",
        synopsis: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
        genres: ["Biography", "Drama", "History"],
        metadata: {
          director: "Christopher Nolan",
          actors: "Cillian Murphy, Emily Blunt, Matt Damon",
          writer: "Christopher Nolan",
          rating: 8.4,
          runtime: 180
        }
      },
      {
        title: "Spider-Man: Across the Spider-Verse",
        year: 2023,
        cover: "https://image.tmdb.org/t/p/w500/8VtBz7uiKST9B3kqZEQ1nQ2CcUq.jpg",
        synopsis: "Miles Morales catapults across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence.",
        genres: ["Animation", "Action", "Adventure"],
        metadata: {
          director: "Joaquim Dos Santos",
          actors: "Shameik Moore, Hailee Steinfeld, Oscar Isaac",
          writer: "Phil Lord, Christopher Miller",
          rating: 8.6,
          runtime: 140
        }
      },
      {
        title: "Everything Everywhere All at Once",
        year: 2022,
        cover: "https://image.tmdb.org/t/p/w500/w3G7uGHWSpuxt95t7vNu7VppJu0.jpg",
        synopsis: "A middle-aged Chinese immigrant is swept up into an insane adventure in which she alone can save existence by exploring other universes.",
        genres: ["Sci-Fi", "Action", "Comedy"],
        metadata: {
          director: "Daniel Kwan, Daniel Scheinert",
          actors: "Michelle Yeoh, Stephanie Hsu, Ke Huy Quan",
          writer: "Daniel Kwan, Daniel Scheinert",
          rating: 8.1,
          runtime: 139
        }
      },
      {
        title: "Interstellar",
        year: 2014,
        cover: "https://image.tmdb.org/t/p/w500/gEU2QvIPG6mUsuecmP2IPuND669.jpg",
        synopsis: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
        genres: ["Sci-Fi", "Adventure", "Drama"],
        metadata: {
          director: "Christopher Nolan",
          actors: "Matthew McConaughey, Anne Hathaway, Jessica Chastain",
          writer: "Jonathan Nolan, Christopher Nolan",
          rating: 8.7,
          runtime: 169
        }
      },
      {
        title: "Inception",
        year: 2010,
        cover: "https://image.tmdb.org/t/p/w500/o01vCoXCJuHjcyoZJYS68ahr62q.jpg",
        synopsis: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea.",
        genres: ["Sci-Fi", "Action", "Adventure"],
        metadata: {
          director: "Christopher Nolan",
          actors: "Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page",
          writer: "Christopher Nolan",
          rating: 8.8,
          runtime: 148
        }
      },
      {
        title: "The Dark Knight",
        year: 2008,
        cover: "https://image.tmdb.org/t/p/w500/qJ2tWw7562go9szmOIYk7t74t1q.jpg",
        synopsis: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological tests.",
        genres: ["Action", "Crime", "Drama"],
        metadata: {
          director: "Christopher Nolan",
          actors: "Christian Bale, Heath Ledger, Aaron Eckhart",
          writer: "Jonathan Nolan, Christopher Nolan",
          rating: 9.0,
          runtime: 152
        }
      },
      {
        title: "The Matrix",
        year: 1999,
        cover: "https://image.tmdb.org/t/p/w500/f89U3wzqrjFmZ6v2Dy49ZJm6hCl.jpg",
        synopsis: "When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth--the life he knows is a deception.",
        genres: ["Sci-Fi", "Action"],
        metadata: {
          director: "Lana Wachowski, Lilly Wachowski",
          actors: "Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss",
          writer: "Lana Wachowski, Lilly Wachowski",
          rating: 8.7,
          runtime: 136
        }
      }
    ],
    upcoming: [
      {
        title: "Avatar: Fire and Ash",
        year: 2025,
        cover: "https://image.tmdb.org/t/p/w500/7aEa6190p62U56m9n1WkK5G1mN3.jpg",
        synopsis: "The upcoming third installment in the Avatar film franchise, exploring the aggressive ash people of Pandora.",
        genres: ["Sci-Fi", "Action", "Adventure"],
        metadata: {
          director: "James Cameron",
          actors: "Sam Worthington, Zoe Saldana, Sigourney Weaver",
          writer: "James Cameron",
          rating: null,
          runtime: 160
        }
      },
      {
        title: "Dune: Messiah",
        year: 2026,
        cover: "https://image.tmdb.org/t/p/w500/czembW0GXTzJ549770gh72e2y2n.jpg",
        synopsis: "The adaptation of Frank Herbert's second Dune novel, concluding Paul Atreides' messianic journey.",
        genres: ["Sci-Fi", "Drama", "Adventure"],
        metadata: {
          director: "Denis Villeneuve",
          actors: "Timothée Chalamet, Florence Pugh, Anya Taylor-Joy",
          writer: "Denis Villeneuve",
          rating: null,
          runtime: 150
        }
      },
      {
        title: "The Batman Part II",
        year: 2026,
        cover: "https://image.tmdb.org/t/p/w500/ii8NX4Pv7626t9Hg9L9OIe4R4fs.jpg",
        synopsis: "The highly anticipated sequel to Matt Reeves' grounded detective take on the Caped Crusader.",
        genres: ["Action", "Crime", "Mystery"],
        metadata: {
          director: "Matt Reeves",
          actors: "Robert Pattinson, Andy Serkis, Jeffrey Wright",
          writer: "Matt Reeves, Mattson Tomlin",
          rating: null,
          runtime: 165
        }
      },
      {
        title: "Spider-Man: Beyond the Spider-Verse",
        year: 2026,
        cover: "https://image.tmdb.org/t/p/w500/8VtBz7uiKST9B3kqZEQ1nQ2CcUq.jpg",
        synopsis: "The dramatic conclusion to Miles Morales' animated multiversal Spider-Verse trilogy.",
        genres: ["Animation", "Action", "Adventure"],
        metadata: {
          director: "Joaquim Dos Santos",
          actors: "Shameik Moore, Hailee Steinfeld, Oscar Isaac",
          writer: "Phil Lord, Christopher Miller",
          rating: null,
          runtime: 145
        }
      },
      {
        title: "Superman",
        year: 2025,
        cover: "https://image.tmdb.org/t/p/w500/zXgS6D3cT3p2x0x9N3W4g8r7t6y.jpg",
        synopsis: "The beginning of the new DC Universe under James Gunn, focusing on Superman balancing his Kryptonian heritage with his human upbringing.",
        genres: ["Action", "Sci-Fi", "Adventure"],
        metadata: {
          director: "James Gunn",
          actors: "David Corenswet, Rachel Brosnahan, Nicholas Hoult",
          writer: "James Gunn",
          rating: null,
          runtime: 150
        }
      },
      {
        title: "Avengers: Doomsday",
        year: 2026,
        cover: "https://image.tmdb.org/t/p/w500/xY3g1jE6nJpZ9aF2v2y3e4r5t6y.jpg",
        synopsis: "The fifth Avengers film, bringing back Robert Downey Jr. to the Marvel Cinematic Universe as Doctor Doom.",
        genres: ["Action", "Sci-Fi", "Adventure"],
        metadata: {
          director: "Anthony Russo, Joe Russo",
          actors: "Robert Downey Jr., Pedro Pascal, Vanessa Kirby",
          writer: "Stephen McFeely",
          rating: null,
          runtime: 160
        }
      }
    ]
  },
  tv: {
    trending: [
      {
        title: "Shōgun",
        year: 2024,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/500/1251761.jpg",
        synopsis: "When a mysterious English ship is found shipwrecked in a nearby fishing village, Lord Yoshii Toranaga discovers secrets that could tip the scales of power.",
        genres: ["Drama", "History", "War"],
        metadata: {
          id: 67184,
          network: "FX",
          rating: 8.7,
          runtime: 60,
          status: "Ended"
        }
      },
      {
        title: "The Last of Us",
        year: 2023,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/477/1194215.jpg",
        synopsis: "Twenty years after modern civilization has been destroyed, Joel, a hardened survivor, is hired to smuggle Ellie, a 14-year-old girl, out of an oppressive quarantine zone.",
        genres: ["Drama", "Action", "Sci-Fi"],
        metadata: {
          id: 48972,
          network: "HBO",
          rating: 8.8,
          runtime: 50,
          status: "Running"
        }
      },
      {
        title: "Succession",
        year: 2018,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/448/1121087.jpg",
        synopsis: "The Roy family is known for controlling the biggest media and entertainment company in the world. However, their world changes when their father steps down.",
        genres: ["Drama"],
        metadata: {
          id: 34165,
          network: "HBO",
          rating: 8.9,
          runtime: 60,
          status: "Ended"
        }
      },
      {
        title: "Breaking Bad",
        year: 2008,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/501/1253515.jpg",
        synopsis: "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine to secure his family's future.",
        genres: ["Drama", "Crime", "Thriller"],
        metadata: {
          id: 179,
          network: "AMC",
          rating: 9.5,
          runtime: 49,
          status: "Ended"
        }
      },
      {
        title: "Severance",
        year: 2022,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/398/996324.jpg",
        synopsis: "Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.",
        genres: ["Sci-Fi", "Drama", "Thriller"],
        metadata: {
          id: 45781,
          network: "Apple TV+",
          rating: 8.7,
          runtime: 45,
          status: "Running"
        }
      },
      {
        title: "The Bear",
        year: 2022,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/511/1279090.jpg",
        synopsis: "A young chef from the fine dining world returns to Chicago to run his family sandwich shop after a heartbreaking death.",
        genres: ["Comedy", "Drama"],
        metadata: {
          id: 61009,
          network: "FX",
          rating: 8.6,
          runtime: 30,
          status: "Running"
        }
      },
      {
        title: "Fallout",
        year: 2024,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/501/1254359.jpg",
        synopsis: "In a future, post-apocalyptic Los Angeles, citizens must live in underground bunkers to protect themselves from radiation, mutants, and bandits.",
        genres: ["Sci-Fi", "Action", "Adventure"],
        metadata: {
          id: 50286,
          network: "Prime Video",
          rating: 8.4,
          runtime: 55,
          status: "Running"
        }
      },
      {
        title: "Stranger Things",
        year: 2016,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/507/1269837.jpg",
        synopsis: "When a young boy vanishes, a town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.",
        genres: ["Drama", "Fantasy", "Mystery"],
        metadata: {
          id: 2993,
          network: "Netflix",
          rating: 8.7,
          runtime: 50,
          status: "Running"
        }
      }
    ],
    upcoming: [
      {
        title: "Stranger Things Season 5",
        year: 2025,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/507/1269837.jpg",
        synopsis: "The epic final season of Stranger Things, concluding the battle against Vecna and the saving of Hawkins.",
        genres: ["Drama", "Fantasy", "Horror"],
        metadata: {
          id: 2993,
          network: "Netflix",
          rating: null,
          runtime: 60,
          status: "In Development"
        }
      },
      {
        title: "The Last of Us Season 2",
        year: 2025,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/477/1194215.jpg",
        synopsis: "The second season continues the story of Joel and Ellie, adapting the complex events of Part II of the game franchise.",
        genres: ["Drama", "Action", "Sci-Fi"],
        metadata: {
          id: 48972,
          network: "HBO",
          rating: null,
          runtime: 55,
          status: "In Production"
        }
      },
      {
        title: "Severance Season 2",
        year: 2025,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/398/996324.jpg",
        synopsis: "The second season of the mind-bending corporate thriller as the 'severed' employees try to expose Lumon.",
        genres: ["Sci-Fi", "Drama", "Thriller"],
        metadata: {
          id: 45781,
          network: "Apple TV+",
          rating: null,
          runtime: 50,
          status: "In Production"
        }
      },
      {
        title: "Wednesday Season 2",
        year: 2025,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/442/1105943.jpg",
        synopsis: "Wednesday Addams returns to Nevermore Academy to solve new supernatural mysteries and deal with school life.",
        genres: ["Comedy", "Fantasy", "Mystery"],
        metadata: {
          id: 54625,
          network: "Netflix",
          rating: null,
          runtime: 50,
          status: "In Production"
        }
      },
      {
        title: "Squid Game Season 2",
        year: 2024,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/415/1039868.jpg",
        synopsis: "Three years after winning Squid Game, Player 456 remains determined to find the people behind it and put an end to their sport.",
        genres: ["Thriller", "Drama", "Action"],
        metadata: {
          id: 46830,
          network: "Netflix",
          rating: null,
          runtime: 55,
          status: "Running"
        }
      },
      {
        title: "House of the Dragon Season 3",
        year: 2026,
        cover: "https://static.tvmaze.com/uploads/images/original_untouched/512/1281577.jpg",
        synopsis: "The third season of the Targaryen civil war, continuing the bloody Dance of the Dragons for control of the Iron Throne.",
        genres: ["Drama", "Action", "Fantasy"],
        metadata: {
          id: 44778,
          network: "HBO",
          rating: null,
          runtime: 60,
          status: "In Development"
        }
      }
    ]
  },
  book: {
    trending: [
      {
        title: "Atomic Habits",
        year: 2018,
        cover: "https://books.google.com/books/content?id=gNDtDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "Tiny Changes, Remarkable Results. An easy and proven way to build good habits and break bad ones, drawing on ideas from biology, psychology, and neuroscience.",
        genres: ["Self-Help", "Productivity", "Psychology"],
        metadata: {
          author: "James Clear",
          publisher: "Avery",
          pages: 320
        }
      },
      {
        title: "Dune",
        year: 1965,
        cover: "https://books.google.com/books/content?id=B1hGDAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, who would become the mysterious man known as Muad'Dib.",
        genres: ["Sci-Fi", "Fantasy", "Adventure"],
        metadata: {
          author: "Frank Herbert",
          publisher: "Chilton Books",
          pages: 604
        }
      },
      {
        title: "The Hobbit",
        year: 1937,
        cover: "https://books.google.com/books/content?id=hF2gAgAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "Bilbo Baggins is a hobbit who enjoys a comfortable, unambitious life, but his contentment is disturbed when the wizard Gandalf and a company of dwarves arrive.",
        genres: ["Fantasy", "Adventure", "Classics"],
        metadata: {
          author: "J.R.R. Tolkien",
          publisher: "George Allen & Unwin",
          pages: 310
        }
      },
      {
        title: "Sapiens: A Brief History of Humankind",
        year: 2011,
        cover: "https://books.google.com/books/content?id=1Y9bAwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "From a renowned historian comes a groundbreaking narrative of humanity's creation and evolution, exploring how shared stories shaped society.",
        genres: ["History", "Science", "Anthropology"],
        metadata: {
          author: "Yuval Noah Harari",
          publisher: "Harper",
          pages: 512
        }
      },
      {
        title: "Thinking, Fast and Slow",
        year: 2011,
        cover: "https://books.google.com/books/content?id=Zu5dNS4uqKAC&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "Nobel laureate Daniel Kahneman explains the two systems that drive the way we think: System 1 (fast, intuitive) and System 2 (slow, deliberate).",
        genres: ["Psychology", "Science", "Economics"],
        metadata: {
          author: "Daniel Kahneman",
          publisher: "Farrar, Straus and Giroux",
          pages: 499
        }
      },
      {
        title: "Project Hail Mary",
        year: 2021,
        cover: "https://books.google.com/books/content?id=7h_zDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "Ryland Grace is the sole survivor on a desperate, last-chance mission to save humanity from an extinction-level event.",
        genres: ["Sci-Fi", "Adventure", "Thriller"],
        metadata: {
          author: "Andy Weir",
          publisher: "Ballantine Books",
          pages: 476
        }
      },
      {
        title: "Deep Work",
        year: 2016,
        cover: "https://books.google.com/books/content?id=qS49CgAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "Rules for Focused Success in a Distracted World. Cal Newport explains how to cultivate deep concentration to produce elite results.",
        genres: ["Productivity", "Business", "Self-Help"],
        metadata: {
          author: "Cal Newport",
          publisher: "Grand Central Publishing",
          pages: 304
        }
      },
      {
        title: "The Psychology of Money",
        year: 2020,
        cover: "https://books.google.com/books/content?id=f_TzDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "Doing well with money isn't necessarily about what you know. It's about how you behave. Timeless lessons on wealth, greed, and happiness.",
        genres: ["Finance", "Business", "Psychology"],
        metadata: {
          author: "Morgan Housel",
          publisher: "Harriman House",
          pages: 256
        }
      }
    ],
    upcoming: [
      {
        title: "Nexus: A Brief History of Information Networks",
        year: 2024,
        cover: "https://books.google.com/books/content?id=dCzuEAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "Harari looks at the flow of information throughout human history, showing how networks can build order but also create illusion.",
        genres: ["History", "Technology", "Philosophy"],
        metadata: {
          author: "Yuval Noah Harari",
          publisher: "Random House",
          pages: 528
        }
      },
      {
        title: "Clear Thinking",
        year: 2023,
        cover: "https://books.google.com/books/content?id=lF-hEAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "Shane Parrish, founder of Farnam Street, gives a guide to mastering the cognitive defaults that lead to bad decisions.",
        genres: ["Self-Help", "Psychology", "Productivity"],
        metadata: {
          author: "Shane Parrish",
          publisher: "Penguin Portfolio",
          pages: 288
        }
      },
      {
        title: "The Winds of Winter",
        year: 2026,
        cover: "https://books.google.com/books/content?id=Zu5dNS4uqKAC&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "The highly anticipated sixth novel in George R.R. Martin's epic high fantasy series, A Song of Ice and Fire.",
        genres: ["Fantasy", "Drama"],
        metadata: {
          author: "George R.R. Martin",
          publisher: "Bantam Books",
          pages: 1000
        }
      },
      {
        title: "The Thorn of Emberlain",
        year: 2026,
        cover: "https://books.google.com/books/content?id=hF2gAgAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        synopsis: "The fourth novel in Scott Lynch's acclaimed Gentleman Bastard fantasy heist adventure series.",
        genres: ["Fantasy", "Adventure"],
        metadata: {
          author: "Scott Lynch",
          publisher: "Gollancz",
          pages: 500
        }
      }
    ]
  },
  anime: {
    trending: [
      {
        title: "Frieren: Beyond Journey's End",
        year: 2023,
        cover: "https://cdn.myanimelist.net/images/anime/1015/138029l.jpg",
        synopsis: "Elf mage Frieren and her courageous fellow adventurers have defeated the Demon King and brought peace to the land. But Frieren must embark on a new journey.",
        genres: ["Fantasy", "Adventure", "Drama"],
        metadata: {
          studio: "Madhouse",
          score: 9.38,
          episodes: 28,
          url: "https://myanimelist.net/anime/52991/Sousou_no_Frieren",
          format: "TV",
          aired: "Sep 2023 to Mar 2024"
        }
      },
      {
        title: "Demon Slayer: Kimetsu no Yaiba",
        year: 2019,
        cover: "https://cdn.myanimelist.net/images/anime/1286/99889l.jpg",
        synopsis: "Tanjiro Kamado sets out to become a demon slayer after his family is slaughtered and his younger sister, Nezuko, is turned into a demon.",
        genres: ["Action", "Fantasy", "Historical"],
        metadata: {
          studio: "ufotable",
          score: 8.5,
          episodes: 26,
          url: "https://myanimelist.net/anime/38000/Kimetsu_no_Yaiba",
          format: "TV",
          aired: "Apr 2019 to Sep 2019"
        }
      },
      {
        title: "Attack on Titan",
        year: 2013,
        cover: "https://cdn.myanimelist.net/images/anime/10/47347l.jpg",
        synopsis: "After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.",
        genres: ["Action", "Drama", "Suspense"],
        metadata: {
          studio: "WIT Studio",
          score: 8.54,
          episodes: 25,
          url: "https://myanimelist.net/anime/16498/Shingeki_no_Kyojin",
          format: "TV",
          aired: "Apr 2013 to Sep 2013"
        }
      },
      {
        title: "Jujutsu Kaisen",
        year: 2020,
        cover: "https://cdn.myanimelist.net/images/anime/1171/109222l.jpg",
        synopsis: "Yuji Itadori, a high school student with extraordinary physical strength, swallows a finger of the legendary curse Ryomen Sukuna to save his friends.",
        genres: ["Action", "Fantasy"],
        metadata: {
          studio: "MAPPA",
          score: 8.63,
          episodes: 24,
          url: "https://myanimelist.net/anime/40748/Jujutsu_Kaisen",
          format: "TV",
          aired: "Oct 2020 to Mar 2021"
        }
      },
      {
        title: "Chainsaw Man",
        year: 2022,
        cover: "https://cdn.myanimelist.net/images/anime/1902/126519l.jpg",
        synopsis: "Denji, a poor young man, merges with his pet chainsaw devil, Pochita, becoming 'Chainsaw Man' and working for the Public Safety Devil Hunters.",
        genres: ["Action", "Fantasy", "Gore"],
        metadata: {
          studio: "MAPPA",
          score: 8.51,
          episodes: 12,
          url: "https://myanimelist.net/anime/44511/Chainsaw_Man",
          format: "TV",
          aired: "Oct 2022 to Dec 2022"
        }
      },
      {
        title: "Monster",
        year: 2004,
        cover: "https://cdn.myanimelist.net/images/anime/10/18793l.jpg",
        synopsis: "Dr. Kenzo Tenma, a brilliant brain surgeon, saves the life of a young boy instead of the town's mayor, only to discover later that the boy has become a psychopathic killer.",
        genres: ["Drama", "Mystery", "Suspense"],
        metadata: {
          studio: "Madhouse",
          score: 8.89,
          episodes: 74,
          url: "https://myanimelist.net/anime/19/Monster",
          format: "TV",
          aired: "Apr 2004 to Sep 2005"
        }
      },
      {
        title: "Fullmetal Alchemist: Brotherhood",
        year: 2009,
        cover: "https://cdn.myanimelist.net/images/anime/1208/94745l.jpg",
        synopsis: "Two brothers search for the Philosopher's Stone to restore their bodies after a failed alchemical attempt to revive their deceased mother.",
        genres: ["Action", "Adventure", "Drama"],
        metadata: {
          studio: "Bones",
          score: 9.1,
          episodes: 64,
          url: "https://myanimelist.net/anime/5114/Fullmetal_Alchemist__Brotherhood",
          format: "TV",
          aired: "Apr 2009 to Jul 2010"
        }
      }
    ],
    upcoming: [
      {
        title: "Solo Leveling Season 2",
        year: 2025,
        cover: "https://cdn.myanimelist.net/images/anime/1761/140232l.jpg",
        synopsis: "The second season following Jinwoo Sung's journey as he grows into an omnipotent hunter, threatening the world's power structures.",
        genres: ["Action", "Fantasy"],
        metadata: {
          studio: "A-1 Pictures",
          score: null,
          episodes: 12,
          url: "https://myanimelist.net/anime/58580/Ore_dake_Level_Up_na_Ken_2nd_Season__Arise_from_the_Shadow",
          format: "TV",
          aired: "Jan 2025"
        }
      },
      {
        title: "Chainsaw Man Movie: Reze Arc",
        year: 2025,
        cover: "https://cdn.myanimelist.net/images/anime/1902/126519l.jpg",
        synopsis: "A sequel film focusing on Denji's fateful encounter with the mysterious girl Reze, the Bomb Devil.",
        genres: ["Action", "Dark Fantasy", "Romance"],
        metadata: {
          studio: "MAPPA",
          score: null,
          episodes: 1,
          url: "https://myanimelist.net/anime/57597/Chainsaw_Man_Movie__Reze-hen",
          format: "Movie",
          aired: "2025"
        }
      },
      {
        title: "One Punch Man Season 3",
        year: 2025,
        cover: "https://cdn.myanimelist.net/images/anime/12/76049l.jpg",
        synopsis: "Saitama and the Hero Association deal with the threat of the Monster Association led by the mysterious Monster King Orochi.",
        genres: ["Action", "Comedy", "Sci-Fi"],
        metadata: {
          studio: "J.C.Staff",
          score: null,
          episodes: 12,
          url: "https://myanimelist.net/anime/53127/One_Punch_Man_3rd_Season",
          format: "TV",
          aired: "2025"
        }
      },
      {
        title: "Demon Slayer: Infinity Castle Movie 1",
        year: 2025,
        cover: "https://cdn.myanimelist.net/images/anime/1286/99889l.jpg",
        synopsis: "The first movie of the epic Infinity Castle trilogy, depicting the final battle against Muzan Kibutsuji and the upper rank demons.",
        genres: ["Action", "Fantasy", "Historical"],
        metadata: {
          studio: "ufotable",
          score: null,
          episodes: 1,
          url: "https://myanimelist.net/anime/59155/Kimetsu_no_Yaiba__Mugen_Jou-hen_1",
          format: "Movie",
          aired: "2025"
        }
      }
    ]
  },
  manga: {
    trending: [
      {
        title: "Berserk",
        year: 1989,
        cover: "https://cdn.myanimelist.net/images/manga/1/157897l.jpg",
        synopsis: "Guts, a former mercenary known as the 'Black Swordsman', seeks revenge against his former commander Griffith who sacrificed his comrades to achieve his ambitions.",
        genres: ["Action", "Dark Fantasy", "Tragedy"],
        metadata: {
          author: "Kentaro Miura",
          volumes: 42,
          chapters: 375,
          url: "https://myanimelist.net/manga/2/Berserk",
          score: 9.47,
          status: "Publishing",
          malId: 2
        }
      },
      {
        title: "One Piece",
        year: 1997,
        cover: "https://cdn.myanimelist.net/images/manga/2/253132l.jpg",
        synopsis: "Monkey D. Luffy, a boy who gains rubber abilities from eating a Devil Fruit, sets out to find the legendary treasure One Piece and become King of the Pirates.",
        genres: ["Action", "Adventure", "Fantasy"],
        metadata: {
          author: "Eiichiro Oda",
          volumes: 108,
          chapters: 1100,
          url: "https://myanimelist.net/manga/13/One_Piece",
          score: 9.22,
          status: "Publishing",
          malId: 13
        }
      },
      {
        title: "Vagabond",
        year: 1998,
        cover: "https://cdn.myanimelist.net/images/manga/1/259275l.jpg",
        synopsis: "A fictionalized retelling of the life of legendary samurai Musashi Miyamoto, shifting from a bloodthirsty warrior to a philosophical master.",
        genres: ["Historical", "Action", "Drama"],
        metadata: {
          author: "Takehiko Inoue",
          volumes: 37,
          chapters: 327,
          url: "https://myanimelist.net/manga/656/Vagabond",
          score: 9.25,
          status: "On Hiatus",
          malId: 656
        }
      },
      {
        title: "Monster",
        year: 1994,
        cover: "https://cdn.myanimelist.net/images/manga/3/258224l.jpg",
        synopsis: "Dr. Kenzo Tenma, a neurosurgeon, finds his life thrown into turmoil after saving a boy who turns out to be a charismatic serial killer.",
        genres: ["Mystery", "Thriller", "Drama"],
        metadata: {
          author: "Naoki Urasawa",
          volumes: 18,
          chapters: 162,
          url: "https://myanimelist.net/manga/1/Monster",
          score: 9.15,
          status: "Finished",
          malId: 1
        }
      },
      {
        title: "Chainsaw Man",
        year: 2018,
        cover: "https://cdn.myanimelist.net/images/manga/3/216853l.jpg",
        synopsis: "Denji is a poor boy who dies and becomes reborn as a hybrid devil, Chainsaw Man, joining public safety hunters.",
        genres: ["Action", "Dark Fantasy", "Comedy"],
        metadata: {
          author: "Tatsuki Fujimoto",
          volumes: 16,
          chapters: 160,
          url: "https://myanimelist.net/manga/116778/Chainsaw_Man",
          score: 8.68,
          status: "Publishing",
          malId: 116778
        }
      }
    ],
    upcoming: [
      {
        title: "Kagurabachi",
        year: 2023,
        cover: "https://cdn.myanimelist.net/images/manga/2/292359l.jpg",
        synopsis: "Chihiro, the son of a legendary swordsmith, seeks vengeance using his father's final enchanted katana against a gang of sorcerers.",
        genres: ["Action", "Fantasy", "Drama"],
        metadata: {
          author: "Takeru Hokazono",
          volumes: 2,
          chapters: 35,
          url: "https://myanimelist.net/manga/162250/Kagurabachi",
          score: 8.41,
          status: "Publishing",
          malId: 162250
        }
      },
      {
        title: "Sakamoto Days",
        year: 2020,
        cover: "https://cdn.myanimelist.net/images/manga/3/245899l.jpg",
        synopsis: "Taro Sakamoto, an legendary retired hitman, lives a quiet life as a convenience store owner, but must protect his family when assassins seek him out.",
        genres: ["Action", "Comedy"],
        metadata: {
          author: "Yuto Suzuki",
          volumes: 16,
          chapters: 165,
          url: "https://myanimelist.net/manga/131334/Sakamoto_Days",
          score: 8.32,
          status: "Publishing",
          malId: 131334
        }
      },
      {
        title: "Choujin X",
        year: 2021,
        cover: "https://cdn.myanimelist.net/images/manga/2/255263l.jpg",
        synopsis: "Tokio Kurohara and Azuma Higashi encounter superpowered beings called Choujins, leading Tokio to transform into a beast-like Choujin.",
        genres: ["Action", "Dark Fantasy", "Sci-Fi"],
        metadata: {
          author: "Sui Ishida",
          volumes: 8,
          chapters: 50,
          url: "https://myanimelist.net/manga/136611/Choujin_X",
          score: 7.95,
          status: "Publishing",
          malId: 136611
        }
      }
    ]
  },
  game: {
    trending: [
      {
        title: "Elden Ring",
        year: 2022,
        cover: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1245620/library_600x900.jpg",
        synopsis: "Rise, Tarnished, and be guided by grace to brandish the power of the Elden Ring and become an Elden Lord in the Lands Between.",
        genres: ["Action", "RPG", "Dark Fantasy"],
        metadata: {
          developer: "FromSoftware Inc.",
          publisher: "Bandai Namco Entertainment",
          platforms: ["PC", "PS5", "Xbox Series X"],
          score: 96,
          steamAppID: 1245620
        }
      },
      {
        title: "Baldur's Gate 3",
        year: 2023,
        cover: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1086940/library_600x900.jpg",
        synopsis: "Gather your party, and return to the Forgotten Realms in a tale of fellowship and betrayal, sacrifice and survival, and the lure of absolute power.",
        genres: ["RPG", "Strategy", "Turn-Based"],
        metadata: {
          developer: "Larian Studios",
          publisher: "Larian Studios",
          platforms: ["PC", "PS5", "Xbox Series X"],
          score: 96,
          steamAppID: 1086940
        }
      },
      {
        title: "Cyberpunk 2077",
        year: 2020,
        cover: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/library_600x900.jpg",
        synopsis: "Cyberpunk 2077 is an open-world, action-adventure RPG set in the megalopolis of Night City, where you play as a cyberpunk mercenary.",
        genres: ["Action", "RPG", "Sci-Fi"],
        metadata: {
          developer: "CD Projekt Red",
          publisher: "CD Projekt Red",
          platforms: ["PC", "PS5", "Xbox Series X"],
          score: 86,
          steamAppID: 1091500
        }
      },
      {
        title: "Hades II",
        year: 2024,
        cover: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1145350/library_600x900.jpg",
        synopsis: "Battle beyond the Underworld using dark magic to confront the Titan of Time in this rogue-like dungeon crawler sequel.",
        genres: ["Action", "Indie", "Rogue-like"],
        metadata: {
          developer: "Supergiant Games",
          publisher: "Supergiant Games",
          platforms: ["PC"],
          score: 90,
          steamAppID: 1145350
        }
      },
      {
        title: "Grand Theft Auto V",
        year: 2013,
        cover: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/271590/library_600x900.jpg",
        synopsis: "When a young street hustler, a retired bank robber and a terrifying psychopath find themselves entangled, they must pull off a series of dangerous heists.",
        genres: ["Action", "Open World", "Crime"],
        metadata: {
          developer: "Rockstar North",
          publisher: "Rockstar Games",
          platforms: ["PC", "PS5", "Xbox Series X"],
          score: 97,
          steamAppID: 271590
        }
      },
      {
        title: "The Witcher 3: Wild Hunt",
        year: 2015,
        cover: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/292030/library_600x900.jpg",
        synopsis: "You are Geralt of Rivia, mercenary monster slayer. Before you stands a war-torn, monster-infested continent you can explore at will.",
        genres: ["Action", "RPG", "Open World"],
        metadata: {
          developer: "CD Projekt Red",
          publisher: "CD Projekt Red",
          platforms: ["PC", "PS5", "Xbox Series X"],
          score: 93,
          steamAppID: 292030
        }
      }
    ],
    upcoming: [
      {
        title: "Grand Theft Auto VI",
        year: 2025,
        cover: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/271590/library_600x900.jpg",
        synopsis: "Grand Theft Auto VI heads to the state of Leonida, home to the neon-soaked streets of Vice City and beyond in the biggest evolution of the series.",
        genres: ["Action", "Adventure", "Open World"],
        metadata: {
          developer: "Rockstar Studios",
          publisher: "Rockstar Games",
          platforms: ["PS5", "Xbox Series X"],
          score: null,
          steamAppID: 271590
        }
      },
      {
        title: "Monster Hunter Wilds",
        year: 2025,
        cover: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2246340/library_600x900.jpg",
        synopsis: "The next generation in the Monster Hunter franchise. Hunt giant monsters in vast, dynamic environments that change in real time.",
        genres: ["Action", "RPG", "Co-op"],
        metadata: {
          developer: "Capcom",
          publisher: "Capcom",
          platforms: ["PC", "PS5", "Xbox Series X"],
          score: null,
          steamAppID: 2246340
        }
      },
      {
        title: "Death Stranding 2: On The Beach",
        year: 2025,
        cover: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1190460/library_600x900.jpg",
        synopsis: "Embark on an inspiring mission of human connection beyond the UCA. Sam Porter Bridges and companions explore new frontiers.",
        genres: ["Action", "Adventure", "Sci-Fi"],
        metadata: {
          developer: "Kojima Productions",
          publisher: "Sony Interactive Entertainment",
          platforms: ["PS5"],
          score: null,
          steamAppID: 1190460
        }
      }
    ]
  },
  comic: {
    trending: [
      {
        title: "Watchmen",
        year: 1986,
        cover: "https://covers.openlibrary.org/b/id/12818862-L.jpg",
        synopsis: "This Hugo Award-winning graphic novel chronicles the fall from grace of a group of superhero crimefighters, exploring a dark alternative history of the Cold War.",
        genres: ["Action", "Superhero", "Mystery"],
        metadata: {
          author: "Alan Moore, Dave Gibbons",
          publisher: "DC Comics",
          olKey: "OL33177W",
          volumes: 1,
          issues: 12
        }
      },
      {
        title: "The Sandman",
        year: 1989,
        cover: "https://covers.openlibrary.org/b/id/8230588-L.jpg",
        synopsis: "An epic comic book series focusing on Dream (aka Morpheus), the Lord of Dreams, and his family, the Endless.",
        genres: ["Fantasy", "Horror", "Drama"],
        metadata: {
          author: "Neil Gaiman",
          publisher: "DC/Vertigo",
          olKey: "OL8987488W",
          volumes: 10,
          issues: 75
        }
      },
      {
        title: "Saga",
        year: 2012,
        cover: "https://covers.openlibrary.org/b/id/8389659-L.jpg",
        synopsis: "Saga is an epic space opera / fantasy comic series following two star-crossed soldiers from opposite sides of a galactic war trying to raise their child.",
        genres: ["Sci-Fi", "Fantasy", "Drama"],
        metadata: {
          author: "Brian K. Vaughan, Fiona Staples",
          publisher: "Image Comics",
          olKey: "OL16281775W",
          volumes: 11,
          issues: 66
        }
      },
      {
        title: "Batman: The Dark Knight Returns",
        year: 1986,
        cover: "https://covers.openlibrary.org/b/id/8225272-L.jpg",
        synopsis: "A middle-aged Bruce Wayne comes out of retirement to fight crime in a dystopian, decaying Gotham City.",
        genres: ["Superhero", "Action", "Crime"],
        metadata: {
          author: "Frank Miller",
          publisher: "DC Comics",
          olKey: "OL485493W",
          volumes: 1,
          issues: 4
        }
      },
      {
        title: "Invincible",
        year: 2003,
        cover: "https://covers.openlibrary.org/b/id/8372659-L.jpg",
        synopsis: "Mark Grayson, the teenage son of Omni-Man, the most powerful superhero on Earth, develops powers of his own and learns the dark truth of his father's heritage.",
        genres: ["Superhero", "Action", "Gore"],
        metadata: {
          author: "Robert Kirkman",
          publisher: "Image Comics",
          olKey: "OL19556819W",
          volumes: 3,
          issues: 144
        }
      }
    ],
    upcoming: [
      {
        title: "Ultimate Spider-Man",
        year: 2024,
        cover: "https://covers.openlibrary.org/b/id/12818862-L.jpg",
        synopsis: "A new take on a middle-aged Peter Parker who gains powers later in life, raising a family while learning to be a hero.",
        genres: ["Superhero", "Action", "Drama"],
        metadata: {
          author: "Jonathan Hickman, Marco Checchetto",
          publisher: "Marvel Comics",
          olKey: "OL33177W",
          volumes: 1,
          issues: 12
        }
      },
      {
        title: "Batman: Gargoyle of Gotham",
        year: 2023,
        cover: "https://covers.openlibrary.org/b/id/8225272-L.jpg",
        synopsis: "A dark, self-contained noir story focusing on Batman's psychological obsession with Gotham City.",
        genres: ["Superhero", "Crime", "Mystery"],
        metadata: {
          author: "Rafael Grampá",
          publisher: "DC Comics",
          olKey: "OL485493W",
          volumes: 1,
          issues: 4
        }
      }
    ]
  }
};
