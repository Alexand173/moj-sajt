import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Globalna promenljiva sprečava Next.js da pravi novu instancu pri svakom renderu komponente
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
};

// Zadržavamo i stari eksport radi kompatibilnosti ako negde uvoziš direktno { supabase }
export const supabase = getSupabaseClient();