'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase'; // Uvozimo direktno tvoj supabase klijent
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Funkcija za brzu registraciju preko Google-a i Facebook-a
  const handleSocialSignUp = async (providerName: 'google' | 'facebook') => {
  if (typeof window === 'undefined') return;

  const isProduction = !window.location.hostname.includes('localhost');
  const targetRedirect = isProduction 
    ? 'https://www.musictop.net/auth/callback' 
    : 'http://localhost:3000/auth/callback';

  const { error } = await supabase.auth.signInWithOAuth({
    provider: providerName,
    options: {
      redirectTo: targetRedirect, // 🔥 Prisilna putanja rešava problem sa modalom
      queryParams: providerName === 'google' ? {
        access_type: 'offline',
        prompt: 'consent',
      } : undefined,
    },
  });

  if (error) {
    console.error(`REGISTER ERROR: ${error.message.toUpperCase()}`);
  }
};

  // Tvoja funkcija za ručnu registraciju
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Provera okruženja za potvrdu mejla
    const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
    const targetRedirect = isProduction 
      ? 'https://www.musictop.net/auth/callback' 
      : 'http://localhost:3000/auth/callback';

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          avatar_url: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150',
        },
        emailRedirectTo: targetRedirect, // 🔥 Link iz mejla će sada ispravno aktivirati route.ts na serveru
      },
    });

    setLoading(false);

    if (error) {
      setMessage(`ERROR: ${error.message.toUpperCase()}`);
    } else {
      setMessage('SUCCESS: CHECK YOUR EMAIL TO CONFIRM REGISTRATION!');
      setEmail('');
      setPassword('');
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
      setAvatarUrl('');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 font-sans uppercase font-black py-12">
      <div className="max-w-md w-full border-4 border-white p-8 bg-zinc-950 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]">
        <h2 className="text-3xl font-black tracking-tighter mb-6 text-center border-b-4 border-white pb-4 text-white">
          JOIN THE FEED
        </h2>

        {message && (
          <div className="p-3 border-2 border-purple-500 bg-purple-950/50 text-purple-300 text-xs font-bold mb-6 normal-case">
            {message}
          </div>
        )}

        {/* --- SEKCIJA ZA BRZU REGISTRACIJU (GOOGLE & FACEBOOK) --- */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => handleSocialSignUp('google')}
            type="button"
            className="py-2.5 border-2 border-zinc-800 bg-zinc-900 hover:border-white hover:bg-zinc-800 transition text-xs font-bold tracking-tight text-center text-white cursor-pointer"
          >
            GOOGLE
          </button>
          <button
            onClick={() => handleSocialSignUp('facebook')}
            type="button"
            className="py-2.5 border-2 border-zinc-800 bg-zinc-900 hover:border-white hover:bg-zinc-800 transition text-xs font-bold tracking-tight text-center text-white cursor-pointer"
          >
            FACEBOOK
          </button>
        </div>

        {/* --- LINIJA RAZDELNIK --- */}
        <div className="flex items-center text-center text-zinc-500 text-[10px] tracking-widest mb-6">
          <div className="flex-1 h-[2px] bg-zinc-800"></div>
          <span className="px-3 font-bold">OR ENTER DETAILS MANUALLY</span>
          <div className="flex-1 h-[2px] bg-zinc-800"></div>
        </div>

        {/* --- RUČNA FORMA --- */}
        <form onSubmit={handleRegister} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold mb-1 text-zinc-400">FIRST NAME</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full p-2 border-2 border-zinc-800 bg-zinc-900 focus:border-purple-500 focus:outline-none text-sm font-medium normal-case text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-zinc-400">LAST NAME</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full p-2 border-2 border-zinc-800 bg-zinc-900 focus:border-purple-500 focus:outline-none text-sm font-medium normal-case text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-zinc-400">AVATAR URL (OPTIONAL)</label>
            <input
              type="url"
              placeholder="https://..."
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full p-2 border-2 border-zinc-800 bg-zinc-900 focus:border-purple-500 focus:outline-none text-sm font-medium normal-case text-white"
            />
          </div>

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
            disabled={loading}
            className="w-full py-3 bg-purple-600 text-white border-2 border-white hover:bg-white hover:text-black transition duration-300 font-bold cursor-pointer"
          >
            {loading ? 'CREATING ACCOUNT...' : 'REGISTER'}
          </button>
        </form>

        <p className="text-center text-xs mt-6 text-zinc-400">
          ALREADY REGISTERED?{' '}
          <Link href="/login" className="underline hover:text-purple-500 text-white">
            LOG IN HERE
          </Link>
        </p>
      </div>
    </div>
  );
}