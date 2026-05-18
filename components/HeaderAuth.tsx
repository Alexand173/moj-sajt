'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

interface UserProfile {
  first_name?: string;
  avatar_url?: string;
}

export default function HeaderAuth() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    // Glavna i jedina sigurna funkcija za proveru korisnika i profila
    const checkAuth = async () => {
      try {
        // Tražimo sesiju preko zvaničnog SDK-a koji sam čita sve tipove kolačića
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);
          
          // Ako imamo korisnika, bezbedno povlačimo profil iz baze
          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, avatar_url')
            .eq('id', session.user.id)
            .single();

          if (isMounted && profileData) {
            setProfile(profileData);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("Greška pri autentifikaciji:", error);
      } finally {
        // 🚨 KLJUČNI SPAS: Loading SE GASI pod obavezno, bio korisnik ulogovan ili ne!
        if (isMounted) {
          setIsAuthenticating(false);
        }
      }
    };

    // Pokreni proveru odmah
    checkAuth();

    // Prati promene stanja (npr. kada klikne na Login ili Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setIsAuthenticating(false);
        router.refresh();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setIsAuthenticating(false);
        router.refresh();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, supabase]);

  const handleLogout = async () => {
    try {
      setIsAuthenticating(true);
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
      }
    } catch (e) {
      console.error("Greška pri odjavi:", e);
      setIsAuthenticating(false);
    }
  };

  // ⏳ 1. KRATKOTRAJNI LOADER (Sada se gasi čim stigne bilo kakav odgovor iz SDK-a)
  if (isAuthenticating) {
    return (
      <div className="flex items-center shrink-0 relative z-[9999] pointer-events-auto">
        <span className="text-[10px] tracking-widest text-purple-500 font-black animate-pulse">
          LOADING...
        </span>
      </div>
    );
  }

  // 🟢 2. KORISNIK JE USPEŠNO PRONAĐEN I ULOGOVAN
  if (user) {
    const displayName = profile?.first_name 
      ? `${profile.first_name}`.toUpperCase() 
      : user.email?.split('@')[0].toUpperCase() || 'KORISNIK';

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

  // 🔴 3. GOST (Ako nema sesije, prikazujemo normalna dugmad umesto loadinga)
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

export const dynamic = 'force-dynamic';