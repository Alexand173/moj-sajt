'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface UserProfile {
  first_name?: string;
  avatar_url?: string;
}

export default function HeaderAuth() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // ⏳ STAND-BY STANJE: Kreće kao true dok se sve ne učita i proveri
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUserAndProfile = async () => {
      try {
        const { data: { user: activeUser } } = await supabase.auth.getUser();
        if (activeUser) {
          setUser(activeUser);
          const { data, error } = await supabase
            .from('profiles')
            .select('first_name, avatar_url')
            .eq('id', activeUser.id)
            .single();
          
          if (!error && data) {
            setProfile(data);
          }
        }
      } catch (err) {
        console.error("Supabase provera greska:", err);
      } finally {
        setIsAuthenticating(false);
      }
    };

    checkUserAndProfile();

    // ✅ POPRAVLJENO: Čista sintaksa koja sluša promene i upravlja stand-by stanjem
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      setIsAuthenticating(true);

      if (session?.user) {
        setUser(session.user);
        
        // 🔁 "AWAIT" PETLJA: Pokušava da uhvati profil iz baze do 5 puta (na svakih 400ms)
        let profileData = null;
        for (let i = 0; i < 5; i++) {
          const { data } = await supabase
            .from('profiles')
            .select('first_name, avatar_url')
            .eq('id', session.user.id)
            .single();
          
          if (data) {
            profileData = data;
            break; // Profil je pronađen u SQL bazi, prekidamo čekanje!
          }
          // Ako baza još uvek zapisuje, sačekaj 400ms pa probaj ponovo
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
        
        if (profileData) setProfile(profileData);
        router.refresh();
      } else {
        setUser(null);
        setProfile(null);
        router.refresh();
      }

      setIsAuthenticating(false);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    try {
      setIsAuthenticating(true);
      setUser(null);
      setProfile(null);

      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();

        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });

        const cookies = document.cookie.split(";");
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf("=");
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;";
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname + ";";
        }
      }

      await supabase.auth.signOut();
    } catch (e) {
      console.error("Supabase signOut tiha greska:", e);
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  };

  // ⏳ 1. SLUČAJ NA ČEKANJU (STAND-BY): Dok traje provera i upis u bazu, piše LOADING...
  if (isAuthenticating) {
    return (
      <div className="flex items-center shrink-0 relative z-[9999] pointer-events-auto">
        <span className="text-[10px] tracking-widest text-purple-500 font-black animate-pulse">
          LOADING...
        </span>
      </div>
    );
  }

  // 🟢 2. SLUČAJ: KORISNIK JE KONAČNO ULOGOVAN
  if (user) {
    const displayName = profile?.first_name 
      ? `${profile.first_name}`.toUpperCase() 
      : user.email?.split('@')[0].toUpperCase();

    const avatar = profile?.avatar_url || 'https://images.unsplash.com/photo-153713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';

    return (
      <div className="flex items-center gap-3 shrink-0 relative z-[9999] pointer-events-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <img 
            src={avatar} 
            alt="Avatar" 
            className="w-5 h-5 rounded-full border border-white/20 object-cover shrink-0" 
          />
          <span className="text-[10px] tracking-wider text-zinc-400 font-black whitespace-nowrap">@{displayName}</span>
        </div>
        
        <button 
          type="button"
          onClick={handleLogout}
          className="px-2.5 py-1 bg-white text-black hover:bg-purple-600 hover:text-white text-[10px] font-black border border-black transition-colors duration-200 cursor-pointer shrink-0 relative z-[10000] pointer-events-auto"
        >
          LOGOUT
        </button>
      </div>
    );
  }

  // 🔴 3. SLUČAJ: GOST (KORISNIK NIJE ULOGOVAN)
  return (
    <div className="flex items-center gap-2 shrink-0 relative z-[9999] pointer-events-auto">
      <button 
        type="button"
        onClick={() => router.push('/login')}
        className="px-2.5 py-1 bg-white text-black hover:bg-purple-600 hover:text-white border border-black text-[10px] font-black cursor-pointer transition-colors shrink-0"
      >
        LOGIN
      </button>
      <button 
        type="button"
        onClick={() => router.push('/register')}
        className="px-2.5 py-1 bg-black text-white hover:bg-purple-600 border border-white/20 text-[10px] font-black cursor-pointer transition-colors shrink-0"
      >
        REGISTER
      </button>
    </div>
  );
}

// ⚡ Zabranjuje Vercel-u da kešira ovu komponentu na statičkim stranicama kategorija
export const dynamic = 'force-dynamic';