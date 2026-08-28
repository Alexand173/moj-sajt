'use client';

import { useEffect, useState } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { syncCurrentUserProfile } from '@/lib/profile-sync-client';

interface UserProfile {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-153713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';

function getNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getMetadataAvatar(metadata: Record<string, unknown>): string | null {
  const directAvatar = getNonEmptyString(metadata.avatar_url)
    || getNonEmptyString(metadata.picture)
    || getNonEmptyString(metadata.avatar_url_path);
  if (directAvatar) return directAvatar;

  if (metadata.picture && typeof metadata.picture === 'object') {
    const pictureData = (metadata.picture as { data?: { url?: unknown } }).data;
    return getNonEmptyString(pictureData?.url);
  }

  return null;
}

function getFallbackProfile(user: User): UserProfile {
  const metadata = user.user_metadata ?? {};
  const fullName = getNonEmptyString(metadata.full_name)
    || getNonEmptyString(metadata.name)
    || getNonEmptyString(metadata.user_name);
  const givenName = getNonEmptyString(metadata.first_name)
    || getNonEmptyString(metadata.given_name)
    || fullName?.split(/\s+/)[0];
  const familyName = getNonEmptyString(metadata.last_name)
    || getNonEmptyString(metadata.family_name)
    || (fullName?.split(/\s+/).slice(1).join(' ') || null);

  return {
    first_name: givenName || getNonEmptyString(user.email)?.split('@')[0] || 'User',
    last_name: familyName,
    avatar_url: getMetadataAvatar(metadata),
  };
}

function mergeProfiles(fallback: UserProfile, profile: UserProfile | null): UserProfile {
  return {
    first_name: getNonEmptyString(profile?.first_name) || fallback.first_name,
    last_name: getNonEmptyString(profile?.last_name) || fallback.last_name,
    avatar_url: getNonEmptyString(profile?.avatar_url) || fallback.avatar_url,
  };
}

export default function HeaderAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const hydrateSession = async (session: Session | null) => {
      if (!isMounted) return;

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setIsAuthenticating(false);
        return;
      }

      const nextUser = session.user;
      const fallbackProfile = getFallbackProfile(nextUser);
      setUser(nextUser);
      setProfile(fallbackProfile);
      // Render provider metadata immediately; the public profile lookup is only
      // a refinement and must not make the signed-in header appear stuck.
      setIsAuthenticating(false);

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url')
          .eq('id', nextUser.id)
          .maybeSingle();

        if (!isMounted) return;

        if (profileData) {
          setProfile(mergeProfiles(fallbackProfile, profileData));
        }

        const needsRepair = Boolean(profileError)
          || !profileData
          || !getNonEmptyString(profileData.first_name)
          || !getNonEmptyString(profileData.avatar_url);

        if (needsRepair) {
          try {
            // Repair missing OAuth profile fields on the server, where the
            // service role can bypass an RLS policy that blocks client writes.
            await syncCurrentUserProfile();
            const { data: repairedProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name, avatar_url')
              .eq('id', nextUser.id)
              .maybeSingle();

            if (isMounted && repairedProfile) {
              setProfile(mergeProfiles(fallbackProfile, repairedProfile));
            }
          } catch (profileSyncError) {
            // Provider metadata remains visible even when profile repair is
            // unavailable, so OAuth sign-in still has useful account UI.
            console.error('PROFILE_SYNC_ON_SESSION_ERROR:', profileSyncError);
          }
        }
      } catch (error) {
        // The header still displays the provider name/photo fallback.
        console.error('PROFILE_LOOKUP_ON_SESSION_ERROR:', error);
      }
    };

    const loadInitialSession = async () => {
      let timeoutId: number | undefined;

      try {
        const sessionRequest = supabase.auth.getSession();
        const result = await Promise.race([
          sessionRequest,
          new Promise<null>((resolve) => {
            timeoutId = window.setTimeout(() => resolve(null), 5000);
          }),
        ]);

        if (result) {
          await hydrateSession(result.data.session);
        } else if (isMounted) {
          // Never leave the whole header blocked by a slow auth refresh.
          // SIGNED_IN will hydrate the account if the session arrives later.
          setIsAuthenticating(false);
        }
      } catch (error) {
        console.error('AUTH_SESSION_LOOKUP_ERROR:', error);
        if (isMounted) setIsAuthenticating(false);
      } finally {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      }
    };

    void loadInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!isMounted) return;

      if ((event === 'INITIAL_SESSION'
        || event === 'SIGNED_IN'
        || event === 'USER_UPDATED'
        || event === 'TOKEN_REFRESHED') && session?.user) {
        // Supabase recommends deferring follow-up auth calls from this callback
        // to avoid blocking the auth state-change lock.
        window.setTimeout(() => {
          void hydrateSession(session);
        }, 0);
        router.refresh();
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
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
  }, [router]);

  const handleLogout = async () => {
    try {
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
    const displayName = [profile?.first_name, profile?.last_name]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      || user.email?.split('@')[0]
      || 'User';
    const avatar = profile?.avatar_url || DEFAULT_AVATAR;

    return (
      <div className="flex items-center gap-2" aria-label={`Signed in as ${displayName}`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <img
            src={avatar}
            alt={`${displayName} profile picture`}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={(event) => {
              if (event.currentTarget.src !== DEFAULT_AVATAR) {
                event.currentTarget.src = DEFAULT_AVATAR;
              }
            }}
            className="size-6 shrink-0 rounded-full border border-white/30 object-cover"
          />
          <span className="max-w-28 truncate text-[9px] font-black tracking-[0.1em] text-white/75 uppercase" title={displayName}>
            {displayName}
          </span>
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
