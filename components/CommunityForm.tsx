'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { savePost } from '../app/actions';
import Link from 'next/link';

export default function CommunityForm({ region }: { region: string }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Izvlačimo profil da bismo imali ime i avatar
        const { data } = await supabase
          .from('profiles')
          .select('first_name, avatar_url')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    };

    checkUser();

    // Pratimo ako se stanje promeni
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Dok se učitava status korisnika, prikazujemo jednostavan skelet
  if (loading) {
    return (
      <div className="p-4 border-2 border-black animate-pulse text-xs font-black">
        LOADING COMMUNITY HUB...
      </div>
    );
  }

  // Slučaj 1: Korisnik NIJE ulogovan - Ne damo mu da piše post
  if (!user) {
    return (
      <div className="p-6 border-4 border-white bg-zinc-950 text-center space-y-4 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]">
        <p className="text-sm font-black tracking-widest text-zinc-400">
          YOU MUST BE LOGGED IN TO SHARE POSTS IN THE COMMUNITY HUB!
        </p>
        <Link 
          href="/login" 
          className="inline-block px-6 py-2.5 bg-purple-600 text-white border-2 border-white hover:bg-white hover:text-black font-bold text-xs tracking-widest transition-all duration-300"
        >
          LOGIN TO POST
        </Link>
      </div>
    );
  }

  const displayName = profile?.first_name 
    ? profile.first_name.toUpperCase() 
    : user.email?.split('@')[0].toUpperCase();

  const avatar = profile?.avatar_url || 'https://images.unsplash.com/photo-153713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';

  // Slučaj 2: Korisnik JE ulogovan - Prikazujemo formu bez polja za ime
  return (
    <form 
      action={async (formData) => {
        await savePost(formData); 
      }} 
      className="p-6 border-4 border-white bg-zinc-950 space-y-4 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)] text-left"
    >
      {/* Skriveni podaci koji idu u bazu automatski */}
      <input type="hidden" name="region" value={region} />
      <input type="hidden" name="author_id" value={user.id} />

      {/* Info o autoru na vrhu forme */}
      <div className="flex items-center gap-3 border-b-2 border-white/10 pb-3 mb-2">
        <img 
          src={avatar} 
          alt="Avatar" 
          className="w-8 h-8 rounded-full border-2 border-purple-500 object-cover"
        />
        <span className="text-xs font-black tracking-widest text-zinc-400">
          POSTING AS: <span className="text-white">@{displayName}</span>
        </span>
      </div>

      <div>
        <label className="block text-[10px] font-black text-zinc-500 mb-1 tracking-widest">POST TITLE</label>
        <input 
          type="text" 
          name="title" 
          placeholder="Title..." 
          required 
          className="w-full p-2 border-2 border-zinc-800 bg-zinc-900 focus:border-purple-500 focus:outline-none text-sm font-medium text-white normal-case" 
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-zinc-500 mb-1 tracking-widest">CONTENT</label>
        <textarea 
          name="content" 
          placeholder="Content..." 
          required 
          className="w-full p-2 border-2 border-zinc-800 bg-zinc-900 focus:border-purple-500 focus:outline-none text-sm font-medium text-white min-h-[120px] normal-case" 
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-zinc-500 mb-1 tracking-widest">POST IMAGE</label>
        <input 
          type="file" 
          name="post_image" 
          accept="image/*" 
          required 
          className="w-full p-2 border-2 border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-400 file:mr-4 file:py-1 file:px-3 file:border-0 file:text-xs file:font-black file:bg-purple-600 file:text-white hover:file:bg-white hover:file:text-black file:cursor-pointer"
        />
      </div>

      <button 
        type="submit" 
        className="w-full py-3 bg-white text-black border-2 border-white hover:bg-purple-600 hover:text-white transition duration-300 font-black tracking-widest text-xs"
      >
        PUBLISH POST
      </button>
    </form>
  );
}