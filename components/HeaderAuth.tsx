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
    // 🛡️ SIGURNOSNA PROVERA: Ako uopšte nema Supabase kolačića u browseru, odmah prekini loading (korisnik je gost)
    if (typeof window !== 'undefined') {
      const hasSessionCookie = document.cookie.split(';').some(c => c.trim().startsWith('sb-'));
      if (!hasSessionCookie) {
        setIsAuthenticating(false);
      }
    }

    const fetchUserAndProfile = async (currentUser: any) => {
      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setIsAuthenticating(false);
        return;
      }

      setUser(currentUser);

      // Agresivna petlja: Tražimo profil iz baze na svakih 300ms (maksimalno 5 puta)
      let profileData = null;
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, avatar_url')
          .eq('id', currentUser.id)
          .single();

        if (data) {
          profileData = data;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      if (profileData) {
        setProfile(profileData);
      }
      setIsAuthenticating(false);
    };

    // 1. Provera aktivne sesije odmah pri učitavanju
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      fetchUserAndProfile(currentUser);
    }).catch(() => {
      setIsAuthenticating(false);
    });

    // 2. Instant reakcija na promenu stanja sa ugrađenim hard-refresh-om za keš
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setIsAuthenticating(true);
        await fetchUserAndProfile(session.user);
        router.refresh();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setIsAuthenticating(false);
        router.refresh();
      }
    });

    // 3. BACK-UP TAJMER: Ako se kôd zaglavi duže od 2.5 sekunde zbog Vercel keša, prisilno ugasi loading
    const backupTimer = setTimeout(() => {
      setIsAuthenticating(false);
    }, 2500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(backupTimer);
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
      console.error("Signout error:", e);
      setIsAuthenticating(false);
    }
  };

  // ⏳ 1. STANJE ČEKANJA
  if (isAuthenticating) {
    return (
      <div className="flex items-center shrink-0 relative z-[9999] pointer-events-auto">
        <span className="text-[10px] tracking-widest text-purple-500 font-black anonymity-pulse animate-pulse">
          LOADING...
        </span>
      </div>
    );
  }

  // 🟢 2. ULOGOVAN KORISNIK
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

  // 🔴 3. GOST (LOGIN / REGISTER DUGMIĆI)
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