'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase'; // Uvozimo tvoj supabase klijent
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

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
  // Prvo osvežavamo podatke na serveru (da Next.js sazna za novu sesiju)
  router.refresh(); 
  
  // Odmah zatim klijentski prebacujemo korisnika na početnu stranicu
  router.push('/'); 
}
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 font-sans uppercase font-black">
      <div className="max-w-md w-full border-4 border-white p-8 bg-zinc-950 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]">
        <h2 className="text-3xl font-black tracking-tighter mb-6 text-center border-b-4 border-white pb-4 text-white">
          WELCOME BACK
        </h2>

        {errorMsg && (
          <div className="p-3 border-2 border-red-500 bg-red-950/50 text-red-300 text-xs font-bold mb-6">
            {errorMsg}
          </div>
        )}

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
            disabled={loading}
            className="w-full py-3 bg-white text-black border-2 border-white hover:bg-purple-600 hover:text-white transition duration-300 font-bold"
          >
            {loading ? 'LOGGING IN...' : 'LOG IN'}
          </button>
        </form>

        <p className="text-center text-xs mt-6 text-zinc-400">
          DON'T HAVE AN ACCOUNT?{' '}
          <Link href="/register" className="underline hover:text-purple-500 text-white">
            SIGN UP
          </Link>
        </p>
      </div>
    </div>
  );
}