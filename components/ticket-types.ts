export interface TicketEvent {
  id: string;
  date: string;
  location: string;
  city?: string | null;
  ticket_link?: string | null;
}

export interface GroupedConcert {
  artist_name: string;
  image_url: string;
  events: TicketEvent[];
}

export interface HeroItem {
  artist: string;
  imageUrl: string | null;
  title: string;
  venue: string;
}
