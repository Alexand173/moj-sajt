'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getOAuthRedirect } from '@/lib/oauth';
import { syncCurrentUserProfile } from '@/lib/profile-sync-client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

type SocialProvider = 'google' | 'facebook' | 'custom:instagram' | 'custom:tiktok';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialProvider, setSocialProvider] = useState<SocialProvider | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    const oauthError = new URLSearchParams(window.location.search).get('error');
    if (oauthError) setErrorMsg(`ERROR: ${oauthError.toUpperCase()}`);
  }, []);

  // Social login is completed by /auth/callback, where the profile is
  // synchronized server-side before the user is redirected home.
  const handleSocialLogin = async (providerName: SocialProvider) => {
    if (socialProvider) return;

    setSocialProvider(providerName);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: providerName,
        options: {
          redirectTo: getOAuthRedirect(),
          queryParams: providerName === 'google' ? {
            access_type: 'offline',
            prompt: 'consent',
          } : undefined,
        },
      });

      if (error) {
        setErrorMsg(`ERROR: ${error.message.toUpperCase()}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Social sign-in could not be started.';
      setErrorMsg(`ERROR: ${message.toUpperCase()}`);
    } finally {
      setSocialProvider(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(`ERROR: ${error.message.toUpperCase()}`);
      setLoading(false);
    } else {
      try {
        await syncCurrentUserProfile();
      } catch (profileError) {
        console.error('PROFILE_SYNC_AFTER_LOGIN_ERROR:', profileError);
      }
      router.refresh();
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 font-sans uppercase font-black py-12">
      <div className="max-w-md w-full border-4 border-white p-8 bg-zinc-950 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]">
        <h2 className="text-3xl font-black tracking-tighter mb-6 text-center border-b-4 border-white pb-4 text-white">
          WELCOME BACK
        </h2>

        {errorMsg && (
          <div role="alert" className="p-3 border-2 border-red-500 bg-red-950/50 text-red-300 text-xs font-bold mb-6 normal-case">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => handleSocialLogin('google')}
            disabled={loading || socialProvider !== null}
            aria-busy={socialProvider === 'google'}
            type="button"
            className="py-2.5 border-2 border-zinc-800 bg-zinc-900 hover:border-white hover:bg-zinc-800 transition text-xs font-bold tracking-tight text-center text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {socialProvider === 'google' ? 'OPENING...' : 'GOOGLE'}
          </button>
          <button
            onClick={() => handleSocialLogin('facebook')}
            disabled={loading || socialProvider !== null}
            aria-busy={socialProvider === 'facebook'}
            type="button"
            className="py-2.5 border-2 border-zinc-800 bg-zinc-900 hover:border-white hover:bg-zinc-800 transition text-xs font-bold tracking-tight text-center text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {socialProvider === 'facebook' ? 'OPENING...' : 'FACEBOOK'}
          </button>
          <button
            onClick={() => handleSocialLogin('custom:instagram')}
            disabled={loading || socialProvider !== null}
            aria-busy={socialProvider === 'custom:instagram'}
            type="button"
            className="py-2.5 border-2 border-zinc-800 bg-zinc-900 hover:border-white hover:bg-zinc-800 transition text-xs font-bold tracking-tight text-center text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {socialProvider === 'custom:instagram' ? 'OPENING...' : 'INSTAGRAM'}
          </button>
          <button
            onClick={() => handleSocialLogin('custom:tiktok')}
            disabled={loading || socialProvider !== null}
            aria-busy={socialProvider === 'custom:tiktok'}
            type="button"
            className="py-2.5 border-2 border-zinc-800 bg-zinc-900 hover:border-white hover:bg-zinc-800 transition text-xs font-bold tracking-tight text-center text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {socialProvider === 'custom:tiktok' ? 'OPENING...' : 'TIKTOK'}
          </button>
        </div>

        <div className="flex items-center text-center text-zinc-500 text-[10px] tracking-widest mb-6">
          <div className="flex-1 h-[2px] bg-zinc-800"></div>
          <span className="px-3 font-bold">OR LOGIN MANUALLY</span>
          <div className="flex-1 h-[2px] bg-zinc-800"></div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold mb-1 text-zinc-400">EMAIL ADDRESS</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border-2 border-zinc-800 bg-zinc-900 focus:border-purple-500 focus:outline-none text-sm font-medium normal-case text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-zinc-400">PASSWORD</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border-2 border-zinc-800 bg-zinc-900 focus:border-purple-500 focus:outline-none text-sm font-medium normal-case text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading || socialProvider !== null}
            className="w-full py-3 bg-white text-black border-2 border-white hover:bg-purple-600 hover:text-white transition duration-300 font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'LOGGING IN...' : 'LOG IN'}
          </button>
        </form>

        <p className="text-center text-xs mt-6 text-zinc-400">
          DON&apos;T HAVE AN ACCOUNT?{' '}
          <Link href="/register" className="underline hover:text-purple-500 text-white">
            SIGN UP
          </Link>
        </p>
      </div>
    </div>
  );
}
