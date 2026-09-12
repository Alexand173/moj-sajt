alter table if exists public.koncerti
  add column if not exists video_url text;

comment on column public.koncerti.video_url is
  'Fresh official YouTube tour or announcement video URL for the artist, maintained by the concert-video enrichment worker.';
