create table if not exists public.artist_tour_profiles (
  canonical_slug text primary key,
  canonical_name text not null,
  profile_data jsonb not null default '{}'::jsonb,
  hero_image_url text,
  seo_title text,
  seo_description text,
  source_urls jsonb not null default '[]'::jsonb,
  content_origin text not null default 'supabase' check (content_origin in ('seeded', 'supabase', 'openai-reviewed')),
  ai_status text not null default 'pending' check (ai_status in ('pending', 'generated', 'reviewed', 'rejected')),
  ai_model text,
  ai_generated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artist_tour_aliases (
  alias_key text primary key,
  alias_display text not null,
  canonical_slug text not null references public.artist_tour_profiles(canonical_slug) on delete cascade,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artist_tour_profiles_published_idx
  on public.artist_tour_profiles (published_at)
  where published_at is not null;

create index if not exists artist_tour_aliases_canonical_slug_idx
  on public.artist_tour_aliases (canonical_slug);

alter table public.artist_tour_profiles enable row level security;
alter table public.artist_tour_aliases enable row level security;

drop policy if exists "Published artist tour profiles are public" on public.artist_tour_profiles;
create policy "Published artist tour profiles are public"
  on public.artist_tour_profiles
  for select
  using (published_at is not null);

drop policy if exists "Published artist aliases are public" on public.artist_tour_aliases;
create policy "Published artist aliases are public"
  on public.artist_tour_aliases
  for select
  using (
    exists (
      select 1
      from public.artist_tour_profiles profile
      where profile.canonical_slug = artist_tour_aliases.canonical_slug
        and profile.published_at is not null
    )
  );
