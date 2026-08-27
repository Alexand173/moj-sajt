'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

interface UserProfile {
  first_name?: string;
  avatar_url?: string;
}

export default function HeaderAuth() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : null;

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      if (!supabase) {
        if (isMounted) setIsAuthenticating(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);
          const { data: profileData } = await supabase
            .from('profiles')
            .select('first_name, avatar_url')
            .eq('id', session.user.id)
            .single();

          if (isMounted && profileData) setProfile(profileData);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('Greška pri autentifikaciji:', error);
      } finally {
        if (isMounted) setIsAuthenticating(false);
      }
    };

    checkAuth();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

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
      if (!supabase) return;
      setIsAuthenticating(true);
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Greška pri odjavi:', error);
      setIsAuthenticating(false);
    }
  };

  if (isAuthenticating) {
    return (
      <span className="whitespace-nowrap text-[9px] font-black tracking-[0.16em] text-accent-red uppercase" aria-live="polite">
        Loading...
      </span>
    );
  }

  if (user) {
    const displayName = profile?.first_name
      ? profile.first_name.toUpperCase()
      : user.email?.split('@')[0].toUpperCase() || 'KORISNIK';
    const avatar = profile?.avatar_url || 'https://images.unsplash.com/photo-153713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';

    return (
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 sm:flex">
          <img src={avatar} alt={`${displayName} avatar`} className="size-5 rounded-full border border-white/25 object-cover" />
          <span className="max-w-24 truncate text-[9px] font-black tracking-[0.12em] text-white/60">@{displayName}</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="border border-white/30 px-3 py-2 text-[9px] font-black tracking-[0.16em] text-white transition-colors hover:border-accent-red hover:bg-accent-red"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => router.push('/login')}
        className="hidden border border-white/35 px-3 py-2 text-[9px] font-black tracking-[0.16em] text-white transition-colors hover:border-white hover:bg-white hover:text-ink sm:inline-flex"
      >
        Login
      </button>
      <button
        type="button"
        onClick={() => router.push('/register')}
        className="border border-white bg-white px-3 py-2 text-[9px] font-black tracking-[0.16em] text-ink transition-colors hover:border-accent-red hover:bg-accent-red hover:text-white"
      >
        Register
      </button>
    </div>
  );
}

export const dynamic = 'force-dynamic';
