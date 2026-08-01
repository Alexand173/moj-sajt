export interface ChartSong {
  id: string;
  title: string;
  artist_name: string;
  slika_url: string;
  youtube_id: string;
  votes: number;
  viewers?: number;
  region?: string;
  genre_id?: number;
  genre?: string;
}
