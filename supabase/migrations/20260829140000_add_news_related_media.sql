alter table if exists public.news
  add column if not exists layout1 text,
  add column if not exists layout2 text;

comment on column public.news.layout1 is
  'Primary related media URL for generated LATEST news: canonical YouTube watch URL, or first distinct Wikimedia image fallback.';

comment on column public.news.layout2 is
  'Distinct secondary related image URL for generated LATEST news, rendered after paragraph six.';
