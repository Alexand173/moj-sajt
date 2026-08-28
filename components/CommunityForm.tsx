'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { saveCommunityNews, savePost } from '../app/actions';
import Link from 'next/link';

type CommunityFormMode = 'post' | 'news';
type SubmissionState = { type: 'error' | 'success'; message: string } | null;

export default function CommunityForm({ region, mode = 'post' }: { region: string; mode?: CommunityFormMode }) {
  const isNews = mode === 'news';
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionState, setSubmissionState] = useState<SubmissionState>(null);
  const router = useRouter();

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
    setLoading(false);
  };

  checkUser();

  // 🔥 POPRAVLJENO: Dodati eksplicitni tipovi za _event i session
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
    setUser(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}, []);

  // Dok se učitava status korisnika, prikazujemo jednostavan skelet
  if (loading) {
    return (
      <div className="p-4 border-2 border-black animate-pulse text-xs font-black">
        LOADING {isNews ? 'NEWS PUBLISHER' : 'COMMUNITY HUB'}...
      </div>
    );
  }

  // Slučaj 1: Korisnik NIJE ulogovan - Ne damo mu da piše post/news
  if (!user) {
    return (
      <div className="p-6 border-4 border-white bg-zinc-950 text-center space-y-4 shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]">
        <p className="text-sm font-black tracking-widest text-zinc-400">
          YOU MUST BE LOGGED IN TO {isNews ? 'PUBLISH NEWS' : 'SHARE POSTS'} IN THE COMMUNITY HUB!
        </p>
        <Link 
          href="/login" 
          className="inline-block px-6 py-2.5 bg-purple-600 text-white border-2 border-white hover:bg-white hover:text-black font-bold text-xs tracking-widest transition-all duration-300"
        >
          LOGIN TO {isNews ? 'PUBLISH NEWS' : 'POST'}
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
        setIsSubmitting(true);
        setSubmissionState(null);

        try {
          if (!isNews) {
            await savePost(formData);
            return;
          }

          const result = await saveCommunityNews(formData);
          if ('error' in result) {
            setSubmissionState({ type: 'error', message: result.error || 'The news could not be published.' });
            return;
          }

          setSubmissionState({ type: 'success', message: 'News published successfully.' });
          router.refresh();
        } catch (error) {
          console.error('COMMUNITY_FORM_SUBMIT_ERROR:', error);
          setSubmissionState({
            type: 'error',
            message: isNews ? 'The news could not be published. Please try again.' : 'The post could not be published. Please try again.',
          });
        } finally {
          setIsSubmitting(false);
        }
      }}
      className="space-y-4 border-4 border-white bg-zinc-950 p-6 text-left shadow-[8px_8px_0px_0px_rgba(147,51,234,1)]"
    >
      {/* Skriveni podaci koji idu u bazu automatski */}
      <input type="hidden" name="region" value={region} />
      <input type="hidden" name="author_id" value={user.id} />

      {/* Info o autoru na vrhu forme */}
      <div className="flex items-center gap-3 border-b-2 border-white/10 pb-3 mb-2">
        <img 
          src={avatar} 
          alt="Avatar" 
          loading="lazy"
          decoding="async"
          className="w-8 h-8 rounded-full border-2 border-purple-500 object-cover"
        />
        <span className="text-xs font-black tracking-widest text-zinc-400">
          {isNews ? 'PUBLISHING AS' : 'POSTING AS'}: <span className="text-white">@{displayName}</span>
        </span>
      </div>

      {submissionState && (
        <p
          role={submissionState.type === 'error' ? 'alert' : 'status'}
          aria-live={submissionState.type === 'error' ? 'assertive' : 'polite'}
          className={submissionState.type === 'error'
            ? 'border-2 border-red-500/60 bg-red-950/40 p-3 text-xs font-bold text-red-200'
            : 'border-2 border-emerald-500/60 bg-emerald-950/40 p-3 text-xs font-bold text-emerald-200'}
        >
          {submissionState.message}
        </p>
      )}

      <div>
        <label htmlFor={isNews ? 'community-news-title' : 'community-post-title'} className="mb-1 block text-[10px] font-black tracking-widest text-zinc-500">{isNews ? 'NEWS HEADLINE' : 'POST TITLE'}</label>
        <input
          id={isNews ? 'community-news-title' : 'community-post-title'}
          type="text"
          name="title"
          placeholder={isNews ? 'News headline...' : 'Title...'}
          required
          onInput={() => setSubmissionState(null)}
          className="w-full border-2 border-zinc-800 bg-zinc-900 p-2 text-sm font-medium text-white normal-case focus:border-purple-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor={isNews ? 'community-news-content' : 'community-post-content'} className="mb-1 block text-[10px] font-black tracking-widest text-zinc-500">{isNews ? 'NEWS CONTENT' : 'CONTENT'}</label>
        <textarea
          id={isNews ? 'community-news-content' : 'community-post-content'}
          name="content"
          placeholder={isNews ? 'Write a short news report...' : 'Content...'}
          required
          onInput={() => setSubmissionState(null)}
          className="min-h-[120px] w-full border-2 border-zinc-800 bg-zinc-900 p-2 text-sm font-medium text-white normal-case focus:border-purple-500 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor={isNews ? 'community-news-image' : 'community-post-image'} className="mb-1 block text-[10px] font-black tracking-widest text-zinc-500">{isNews ? 'NEWS IMAGE' : 'POST IMAGE'}</label>
        <input
          id={isNews ? 'community-news-image' : 'community-post-image'}
          type="file"
          name="post_image"
          accept="image/*"
          required
          onInvalid={(event) => {
            if (isNews) {
              setSubmissionState({ type: 'error', message: 'Please select an image for your news.' });
            }
            event.currentTarget.setCustomValidity(isNews ? 'Please select an image for your news.' : '');
          }}
          onChange={(event) => {
            event.currentTarget.setCustomValidity('');
            setSubmissionState(null);
          }}
          className="w-full border-2 border-zinc-800 bg-zinc-900 p-2 text-xs font-bold text-zinc-400 file:mr-4 file:border-0 file:bg-purple-600 file:px-3 file:py-1 file:text-xs file:font-black file:text-white hover:file:bg-white hover:file:text-black file:cursor-pointer"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full border-2 border-white bg-white py-3 text-xs font-black tracking-widest text-black transition duration-300 hover:bg-purple-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-800 disabled:text-zinc-600"
      >
        {isSubmitting ? (isNews ? 'PUBLISHING NEWS...' : 'PUBLISHING POST...') : (isNews ? 'PUBLISH NEWS' : 'PUBLISH POST')}
      </button>
    </form>
  );
}