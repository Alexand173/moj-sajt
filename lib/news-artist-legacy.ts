/**
 * Artists the chart and the tour feed will never contain.
 *
 * `loadKnownArtistNames` builds its index from `songs` and `koncerti` — what is
 * selling tickets this month. That is the right source for a working artist, and
 * it is blind to everyone who is not currently touring: the cleanup report held
 * "Louis Armstrong's Personal Archive Contains 5,000 Photos" (mentalfloss),
 * "How Deadheads became rock and roll's greatest renewable resource" (NPR) and
 * "Alt.Latino: Is Bill Evans techno?" (NPR) as non-music, because a legacy name
 * is not a music word and an archive piece carries no music vocabulary.
 *
 * This list is deliberately narrow and hand-picked: names distinctive enough that
 * finding one in a headline reliably means the story is about that artist. It is
 * not a "famous people" list — actors, athletes and politicians are excluded, and
 * so are band names that are ordinary phrases in English ("New Order", "The Cure",
 * "Kiss"), because "a new order" and "the cure for cancer" are not music stories.
 *
 * Names shorter than six characters are ignored by `buildArtistNameIndex` (its
 * single-token floor), so "Prince", "Bach", "BTS" and "U2" are listed for
 * completeness but never match. Multi-word names have no such limit.
 */
export const LEGACY_ARTIST_NAMES: string[] = [
  // Rock and pop, the obituary and archive end of the catalogue
  'Louis Armstrong', 'Bill Evans', 'Grateful Dead', 'Jerry Garcia', 'Bob Dylan',
  'Leonard Cohen', 'David Bowie', 'Jimi Hendrix', 'Janis Joplin', 'Johnny Cash',
  'Elvis Presley', 'Dolly Parton', 'Paul McCartney', 'John Lennon', 'George Harrison',
  'Keith Richards', 'Mick Jagger', 'Eric Clapton', 'Jimmy Page', 'Robert Plant',
  'Ozzy Osbourne', 'Bruce Springsteen', 'Tom Petty', 'Neil Young', 'Van Morrison',
  'Brian Wilson', 'Beach Boys', 'Pink Floyd', 'Led Zeppelin', 'Rolling Stones',
  'The Beatles', 'Metallica', 'Nirvana', 'Kurt Cobain', 'Pearl Jam', 'Radiohead',
  'Fleetwood Mac', 'Stevie Nicks', 'Lindsey Buckingham', 'Eagles', 'Crosby Stills Nash',
  'Simon and Garfunkel', 'Joni Mitchell', 'Carole King', 'Aretha Franklin', 'Otis Redding',
  'Marvin Gaye', 'Stevie Wonder', 'James Brown', 'Curtis Mayfield', 'Sly Stone',
  'George Clinton', 'Earth Wind and Fire', 'Tina Turner', 'Diana Ross', 'Smokey Robinson',
  'Chuck Berry', 'Little Richard', 'Buddy Holly', 'Patsy Cline', 'Hank Williams',
  'Willie Nelson', 'Waylon Jennings', 'Merle Haggard', 'Loretta Lynn', 'Tammy Wynette',
  // Jazz
  'Miles Davis', 'John Coltrane', 'Ella Fitzgerald', 'Frank Sinatra', 'Nina Simone',
  'Thelonious Monk', 'Charles Mingus', 'Herbie Hancock', 'Wayne Shorter', 'Chick Corea',
  'Keith Jarrett', 'Duke Ellington', 'Count Basie', 'Art Blakey', 'Sonny Rollins',
  'Stan Getz', 'Chet Baker', 'Sarah Vaughan', 'Billie Holiday', 'Dinah Washington',
  'Oscar Peterson', 'Dave Brubeck', 'McCoy Tyner', 'Ron Carter',
  // Classical and opera
  'Beethoven', 'Mozart', 'Wagner', 'Verdi', 'Puccini', 'Chopin', 'Rachmaninoff',
  'Tchaikovsky', 'Handel', 'Haydn', 'Mahler', 'Debussy', 'Ravel', 'Stravinsky',
  'Maria Callas', 'Luciano Pavarotti', 'Placido Domingo', 'Joan Sutherland',
  // Latin, K-pop and the modern catalogue
  'Cazzu', 'Bad Bunny', 'Karol G', 'Shakira', 'Peso Pluma', 'Rosalia', 'Juan Gabriel',
  'Blackpink', 'Stray Kids', 'Girls Generation', 'NewJeans', 'Seventeen', 'BTS',
  'Elvis Costello', 'Nick Cave', 'Iggy Pop', 'Patti Smith', 'Tom Waits', 'Lou Reed',
];
