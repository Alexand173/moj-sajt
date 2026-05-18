'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Koristimo tvoj postojeći klijent!
import Link from 'next/link';

// Tip za praćenje statusa svakog fajla
type FileStatus = {
  id: string;
  name: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
};

export default function AddAlbumTrigger({ region }: { region: string }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  // Provera ulogovanog korisnika
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('first_name, avatar_url')
          .eq('id', user.id)
          .single();
        setProfile(data);
      }
      setLoadingUser(false);
    };

    checkUser();

    // 🔥 POPRAVLJENO: Dodati eksplicitni tipovi (any) da TypeScript ne pravi grešku tokom build-a
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Funkcija za sanitizaciju imena fajlova
  const sanitizeFileName = (name: string) => {
    return name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      setFileStatuses(prev => [
        ...prev, 
        ...newFiles.map((f, idx) => ({
          id: `${f.name}-${Date.now()}-${idx}`,
          name: f.name,
          status: 'pending' as const
        }))
      ]);
    }
  };

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const albumName = formData.get('album_name') as string;
    const imageUrls: string[] = [];

    // Petlja za slanje svake slike pojedinačno u Storage
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      setFileStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'uploading' } : s));

      const safeName = sanitizeFileName(file.name);
      const fileName = `${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('album-images')
        .upload(fileName, file);

      if (uploadError) {
        console.error("Error during upload:", uploadError);
        setFileStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error' } : s));
        continue; 
      }

      const { data } = supabase.storage.from('album-images').getPublicUrl(fileName);
      imageUrls.push(data.publicUrl);

      setFileStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'done' } : s));
    }

    // Upis u bazu podataka
    if (imageUrls.length > 0) {
      try {
        const { error: dbError } = await supabase.from('concert_albums').insert([{ 
          album_name: albumName, 
          region: region, 
          images: imageUrls,
          author_id: user.id // <--- Šaljemo ID ulogovanog korisnika u novu kolonu!
        }]);

        if (dbError) throw dbError;

        alert("Album successfully created!");
        
        // Resetovanje forme
        setFileStatuses([]);
        setFiles([]);
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        console.error("Error saving to database:", err);
        alert("Images uploaded, but saving to the database failed. Please try again.");
      }
    } else {
      alert("No images were successfully uploaded.");
    }

    setLoading(false);
  }

  // Dok se učitava sesija korisnika
  if (loadingUser) {
    return (
      <div className="p-4 border-2 border-white bg-zinc-950 text-xs font-black tracking-widest text-center animate-pulse text-zinc-500">
        LOADING ALBUM CREATOR...
      </div>
    );
  }

  // Slučaj 1: Korisnik NIJE ulogovan
  if (!user) {
    return (
      <div className="p-6 border-4 border-white bg-zinc-950 text-center space-y-4 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]">
        <p className="text-sm font-black tracking-widest text-zinc-400">
          YOU MUST BE LOGGED IN TO CREATE CONCERT ALBUMS!
        </p>
        <Link 
          href="/login" 
          className="inline-block px-6 py-2.5 bg-purple-600 text-white border-2 border-white hover:bg-white hover:text-black font-bold text-xs tracking-widest transition-all duration-300"
        >
          LOGIN TO CREATE
        </Link>
      </div>
    );
  }

  const displayName = profile?.first_name 
    ? profile.first_name.toUpperCase() 
    : user.email?.split('@')[0].toUpperCase();

  const avatar = profile?.avatar_url || 'https://images.unsplash.com/photo-153713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';

  // Slučaj 2: Korisnik JE ulogovan (prikazuje se tamna brutalistička forma)
  return (
    <form 
      onSubmit={handleUpload} 
      className="p-6 border-4 border-white bg-zinc-950 space-y-4 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)] text-left"
    >
      <h2 className="text-lg font-black tracking-tighter uppercase border-b-2 border-white/10 pb-2 text-white">
        CREATE CONCERT ALBUM
      </h2>

      {/* Podaci o autoru */}
      <div className="flex items-center gap-3 bg-zinc-900 p-2.5 border-2 border-zinc-800">
        <img 
          src={avatar} 
          alt="Avatar" 
          className="w-8 h-8 rounded-full border-2 border-purple-500 object-cover"
        />
        <span className="text-xs font-black tracking-widest text-zinc-400">
          CREATOR: <span className="text-white">@{displayName}</span>
        </span>
      </div>
      
      <div>
        <label className="block text-[10px] font-black text-zinc-500 mb-1 tracking-widest">ALBUM NAME</label>
        <input 
          type="text" 
          name="album_name" 
          placeholder="Enter Album Name..." 
          required 
          className="w-full p-2 border-2 border-zinc-800 bg-zinc-900 focus:border-purple-500 focus:outline-none text-sm font-medium text-white normal-case"
        />
      </div>

      <div>
        <label className="block text-[10px] font-black text-zinc-500 mb-1 tracking-widest">CHOOSE IMAGES</label>
        <input 
          type="file" 
          multiple 
          onChange={handleFileChange} 
          required 
          className="w-full p-2 border-2 border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-400 file:mr-4 file:py-1 file:px-3 file:border-0 file:text-xs file:font-black file:bg-purple-600 file:text-white hover:file:bg-white hover:file:text-black file:cursor-pointer"
        />
      </div>
      
      {/* Lista fajlova */}
      {fileStatuses.length > 0 && (
        <ul className="text-[10px] font-bold space-y-1 bg-zinc-900 p-3 border-2 border-zinc-800 max-h-[150px] overflow-y-auto no-scrollbar">
          {fileStatuses.map((f) => (
            <li key={f.id} className="flex justify-between border-b border-zinc-800/50 py-1 text-zinc-400">
              <span className="truncate w-2/3">{f.name}</span>
              <span className="shrink-0 font-black">
                {f.status === 'pending' && "⌛ PENDING"}
                {f.status === 'uploading' && <span className="text-purple-400">🚀 UPLOADING...</span>}
                {f.status === 'done' && <span className="text-emerald-500">✅ SUCCESS</span>}
                {f.status === 'error' && <span className="text-rose-500">❌ ERROR</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button 
        type="submit" 
        disabled={loading || fileStatuses.length === 0}
        className="w-full py-3 bg-white text-black border-2 border-white hover:bg-purple-600 hover:text-white transition duration-300 font-black tracking-widest text-xs disabled:bg-zinc-800 disabled:text-zinc-600 disabled:border-zinc-800 disabled:cursor-not-allowed"
      >
        {loading ? "PROCESSING UPLOADS..." : "SAVE ALBUM"}
      </button>
    </form>
  );
}