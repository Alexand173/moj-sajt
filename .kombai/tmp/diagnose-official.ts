import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.log(JSON.stringify({ error: 'missing supabase env', hasUrl: Boolean(url), hasKey: Boolean(key) }));
  process.exit(0);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

async function count(label: string, build: (q: any) => any) {
  const base = supabase.from('news').select('id', { count: 'exact', head: true }).gte('created_at', since);
  const { count: value, error } = await build(base);
  return { label, count: count === null ? null : value, error: error ? error.message : null };
}

async function main() {
  const results = [];

  for (const category of ['LATEST', 'OFFICIAL']) {
    const base = () => supabase.from('news').select('id', { count: 'exact', head: true }).eq('category', category).gte('created_at', since);
    for (const [name, apply] of [
      ['total7d', (q: any) => q],
      ['aiGeneratedTrue', (q: any) => q.eq('ai_generated', true)],
      ['aiStatusNull', (q: any) => q.is('ai_status', null)],
      ['aiStatusPending', (q: any) => q.eq('ai_status', 'pending')],
      ['aiStatusGenerated', (q: any) => q.eq('ai_status', 'generated')],
      ['aiStatusFallback', (q: any) => q.eq('ai_status', 'fallback')],
      ['aiContentNull', (q: any) => q.is('ai_content', null)],
      ['urlNull', (q: any) => q.is('url', null)],
    ] as Array<[string, (q: any) => any]>) {
      const { count: value, error } = await apply(base());
      results.push({ category, name, count: value, error: error ? error.message : null });
    }
  }

  console.log(JSON.stringify(results, null, 1));

  const sample = await supabase
    .from('news')
    .select('*')
    .eq('category', 'OFFICIAL')
    .order('created_at', { ascending: false })
    .limit(1);

  const row = sample.data?.[0] as Record<string, unknown> | undefined;
  if (!row) {
    console.log(JSON.stringify({ sample: null, error: sample.error?.message ?? null }));
    return;
  }

  const trimmed: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(row)) {
    trimmed[field] = typeof value === 'string' && value.length > 120 ? `<${value.length} chars>` : value;
  }
  console.log(JSON.stringify({ sampleOfficialRow: trimmed }, null, 1));
}

main();
