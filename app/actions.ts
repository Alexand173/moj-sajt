'use server'

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import sharp from 'sharp'; 
import * as cheerio from 'cheerio';
import { getArtistData } from './spotify'; 

// DEFINIŠI SUPABASE NA VRHU (Globalni scope)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// DEFINICIJA TIPA
export interface SyncResult {
  success: boolean;
  count?: number;
  message?: string;
}

// 1. SYNC CONCERTS
export async function syncConcerts(): Promise<SyncResult> {
  const TM_API_KEY = process.env.TICKETMASTER_API_KEY;
  console.log("TM API KEY učitan:", !!TM_API_KEY); // Provera da li ključ uopšte postoji

  const URL = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_API_KEY}&keyword=music&countryCode=US&size=20`;

  try {
    console.log("Pozivam Ticketmaster API...");
    const response = await fetch(URL);
    const data = await response.json();
    
    // Provera da li dobijamo odgovor
    if (!data._embedded?.events) {
      console.log("API odgovor (nema događaja):", JSON.stringify(data, null, 2));
      return { success: false, message: "Nema podataka sa API-ja" };
    }

    console.log(`Dobijeno ${data._embedded.events.length} događaja. Upisujem u bazu...`);

    const events = data._embedded.events.map((e: any) => ({
  artist_name: e.name,
  event_date: e.dates.start.localDate,
  // Pronađi grad i venue (mesto)
  city: e._embedded?.venues?.[0]?.city?.name || "Nepoznato",
  venue: e._embedded?.venues?.[0]?.name || "Nepoznato",
  // Pronađi link - Ticketmaster obično šalje URL ovde
  ticket_url: e.url || null, 
  // Pronađi sliku
  image_url: e.images?.[0]?.url || null,
  region: 'US' 
}));

    const { error } = await supabase.from('koncerti').upsert(events); // Koristi 'events'

if (error) {
  console.error("Supabase greška pri upisu:", error);
  return { success: false, message: error.message };
}

console.log("USPEŠNO UPISANO!");
return { success: true, count: events.length }; // Koristi 'events.length'

  } catch (error) {
    console.error("SERVER ERROR:", error);
    return { success: false, message: "Server error" };
  }
}
// 2. FETCH METADATA
export async function fetchMetadata(url: string) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    return {
      title: $('meta[property="og:title"]').attr('content') || $('title').text(),
      description: $('meta[property="og:description"]').attr('content'),
      image: $('meta[property="og:image"]').attr('content'),
    };
  } catch (error) {
    return { error: "Nije moguće učitati podatke." };
  }
}

// 3. SAVE POST
export async function savePost(formData: FormData) {
  const file = formData.get('post_image') as File | null;
  const region = formData.get('region') as string;
  const title = formData.get('title') as string;
  const author = formData.get('author') as string;
  const content = formData.get('content') as string;

// 1. Provera broja karaktera (npr. limit 1000)
  if (content.length > 1000) {
    console.error("Post is too long!");
    return { error: "Content must not exceed 1000 characters." };
  }

  // 2. Provera broja REČI (ako baš želiš reči, a ne karaktere)
  const wordCount = content.trim().split(/\s+/).length;
  if (wordCount > 200) {
    console.error("Too many word");
    return { error: "The maximum number of words is 200.." };
  }

  if (!file || file.size === 0) {
    console.error("Fajl nije pronađen ili je prazan.");
    return;
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const resizedBuffer = await sharp(buffer)
    .resize({ width: 800 }) 
    .jpeg({ quality: 80 }) 
    .toBuffer();

  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('blog-images')
    .upload(fileName, resizedBuffer, {
        contentType: 'image/jpeg'
    });

  if (uploadError) {
    console.error("Greška pri uploadu:", uploadError);
    return;
  }

  const { data: publicUrlData } = supabase.storage
    .from('blog-images')
    .getPublicUrl(fileName);

  const { error: dbError } = await supabase.from('community_posts').insert([{ 
    region, 
    title, 
    author, 
    content, 
    post_image: publicUrlData.publicUrl ,
    password_check: 'moj_koment_202!' // <--- OVO DODAJ (mora biti ista šifra kao u Supabase Editoru)
  }]);

  if (dbError) {
    console.error("Greška pri upisu u bazu:", dbError);
    return;
  }
  
  revalidatePath(`/news/${region}`);
}

// 4. SAVE COMMENT
export async function saveComment(formData: FormData) {
  const region = formData.get('region') as string;
  const text = formData.get('text') as string;
  const user_name = formData.get('user_name') as string;

  const { error } = await supabase.from('discussions').insert([{ region, text, user_name }]);
  
  if (error) {
    console.error("Greška pri čuvanju komentara:", JSON.stringify(error, null, 2));
    throw new Error("Greška pri čuvanju komentara.");
  }
  
  revalidatePath(`/news/${region}`);
}

// 5. SAVE ALBUM
export async function saveAlbum(formData: FormData) {
  const files = formData.getAll('post_images') as File[];
  const album_name = formData.get('album_name') as string;
  const region = formData.get('region') as string;

  const imageUrls: string[] = [];

  for (const file of files) {
    if (!file || file.size === 0) continue;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('album-images') 
      .upload(fileName, file);

    if (uploadError) {
      console.error("Greška pri uploadu slike:", uploadError);
      continue;
    }

    const { data } = supabase.storage
      .from('album-images')
      .getPublicUrl(fileName);

    imageUrls.push(data.publicUrl);
  }

  if (imageUrls.length > 0) {
    const { error: dbError } = await supabase
      .from('concert_albums')
      .insert([{ 
        album_name, 
        region, 
        images: imageUrls 
      }]);

    if (dbError) {
      console.error("Greška pri upisu u bazu:", dbError);
      return { error: "Neuspešan upis u bazu" };
    }
  }

  revalidatePath(`/tours/${region}`);
  return { success: true };
}

// 6. SUBMIT SUGGESTIONS
export async function submitSuggestions(formData: FormData) {
  const user_name = formData.get('user_name') as string;
  const songs = JSON.parse(formData.get('songs') as string); 

  const { error } = await supabase.from('suggestions').insert([{
    user_name,
    songs: songs.filter((s: string) => s.trim() !== "")
  }]);

  if (error) {
    console.error("Error saving suggestions:", error);
    throw new Error("Failed to save suggestions");
  }

  revalidatePath('/music');
  return { success: true };
}