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

async function main() {
  // Work done since my manual drain finished on 2026-11-04 ~20:10 UTC.
  const sinceDrain = '2026-11-04T20:10:00.000Z';

  const touched = await supabase
    .from('news')
    .select('ai_generated_at')
    .gte('ai_generated_at', sinceDrain)
    .order('ai_generated_at', { ascending: true })
    .limit(1000);

  const stamps = (touched.data ?? []).map((row) => String(row.ai_generated_at));

  const fallbackTotal = await supabase
    .from('news')
    .select('id', { count: 'exact', head: true })
    .eq('ai_status', 'fallback');

  const pendingOfficial = await supabase
    .from('news')
    .select('id, created_at, title, url', { count: 'exact' })
    .eq('category', 'OFFICIAL')
    .eq('ai_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5);

  const oldestPendingOfficial = await supabase
    .from('news')
    .select('created_at')
    .eq('category', 'OFFICIAL')
    .eq('ai_status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1);

  console.log(JSON.stringify({
    rowsTouchedSinceDrain: stamps.length,
    firstTouchedAt: stamps[0] ?? null,
    lastTouchedAt: stamps[stamps.length - 1] ?? null,
    distinctTouchDays: Array.from(new Set(stamps.map((value) => value.slice(0, 10)))),
    fallbackTotalNow: fallbackTotal.count,
    pendingOfficialCount: pendingOfficial.count,
    oldestPendingOfficialAt: oldestPendingOfficial.data?.[0]?.created_at ?? null,
    newestPendingOfficial: (pendingOfficial.data ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      title: String(row.title).slice(0, 60),
    })),
  }, null, 1));
}

main();
