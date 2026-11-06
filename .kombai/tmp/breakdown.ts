import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';

loadEnvConfig(process.cwd());

const url = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.log(JSON.stringify({ error: 'missing supabase env' }));
  process.exit(0);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const sinceDrain = '2026-11-04T20:10:00.000Z';

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

async function count(build: (q: any) => any): Promise<number | null> {
  const { count: value } = await build(supabase.from('news').select('id', { count: 'exact', head: true }));
  return value;
}

async function main() {
  const out: Record<string, unknown> = {};

  for (const category of ['LATEST', 'OFFICIAL']) {
    out[category] = {
      touchedSinceDrain: await count((q) => q.eq('category', category).gte('ai_generated_at', sinceDrain)),
      pendingLast48h: await count((q) => q.eq('category', category).eq('ai_status', 'pending').gte('created_at', daysAgo(2))),
      pendingWithin21d: await count((q) => q.eq('category', category).eq('ai_status', 'pending').gte('created_at', daysAgo(21))),
      pendingTotal: await count((q) => q.eq('category', category).eq('ai_status', 'pending')),
      fallbackTotal: await count((q) => q.eq('category', category).eq('ai_status', 'fallback')),
      generatedAll: await count((q) => q.eq('category', category).eq('ai_status', 'generated')),
      createdLast48h: await count((q) => q.eq('category', category).gte('created_at', daysAgo(2))),
    };
  }

  // Cadence: which hours actually produced rewrites since the drain.
  const touched = await supabase
    .from('news')
    .select('ai_generated_at, category')
    .gte('ai_generated_at', sinceDrain)
    .order('ai_generated_at', { ascending: false })
    .limit(1000);

  const hours = new Map<string, number>();
  for (const row of touched.data ?? []) {
    const stamp = String(row.ai_generated_at);
    const bucket = `${stamp.slice(0, 13)}h`;
    hours.set(bucket, (hours.get(bucket) ?? 0) + 1);
  }

  out.recentRunBuckets = Array.from(hours.entries()).sort().slice(-18).map(([hour, n]) => `${hour}: ${n}`);

  console.log(JSON.stringify(out, null, 1));
}

main();
