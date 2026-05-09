// app/spotify.ts

const getSpotifyToken = async () => {
  const auth = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  
  const data = await res.json();
  return data.access_token;
};

export const getArtistData = async (artistName: string) => {
  const token = await getSpotifyToken();

  // 1. Pronađi ID izvođača
  const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const searchData = await searchRes.json();
  const artist = searchData.artists.items[0];
  if (!artist) return null;

  // 2. Uzmi top pesmu (preview_url)
  const tracksRes = await fetch(`https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=RS`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const tracksData = await tracksRes.json();
  const topTrack = tracksData.tracks[0];

  return {
    name: artist.name,
    image: artist.images[0]?.url,
    preview_url: topTrack?.preview_url || null
  };
};