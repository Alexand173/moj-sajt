import { loadEnvConfig } from '@next/env';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

/**
 * Applies `supabase/migrations/*.sql` in filename order, recording each version in
 * `public.schema_migrations` so a re-run only touches what is new.
 *
 *   npm run db:migrate              # apply pending migrations
 *   npm run db:migrate -- --dry-run # list what would run
 *
 * PostgREST cannot execute DDL, so this needs a real Postgres connection string:
 * Supabase dashboard → Project Settings → Database → Connection string (the pooler
 * on port 6543 is fine). Put it in `.env.local` as `SUPABASE_DB_URL`.
 */

loadEnvConfig(process.cwd());

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TRACKING_TABLE = `
  create table if not exists public.schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )
`;

export function getConnectionString(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.SUPABASE_DB_URL || env.DATABASE_URL || env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      'No database connection string. Set SUPABASE_DB_URL in .env.local — Supabase dashboard → '
      + 'Project Settings → Database → Connection string (pooler, port 6543). The service role key '
      + 'cannot run DDL, so the REST API is not an option.',
    );
  }

  return url;
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const connectionString = getConnectionString();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  await client.connect();

  try {
    await client.query(TRACKING_TABLE);
    const { rows } = await client.query<{ version: string }>('select version from public.schema_migrations');
    const applied = new Set(rows.map((row) => row.version));

    const files = migrationFiles();
    console.log(`${files.length} migration files, ${applied.size} already recorded.`);

    let ran = 0;
    for (const file of files) {
      const version = file.replace(/\.sql$/, '');

      if (applied.has(version)) {
        console.log(`  skip    ${file}`);
        continue;
      }

      if (dryRun) {
        console.log(`  pending ${file}`);
        continue;
      }

      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into public.schema_migrations (version) values ($1)', [version]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw new Error(`${file} failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      ran += 1;
      console.log(`  applied ${file}`);
    }

    const check = await client.query(
      `select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'profiles' and column_name = 'saved_events'`,
    );
    console.log(check.rowCount
      ? 'profiles.saved_events is present.'
      : 'profiles.saved_events is MISSING.');

    console.log(dryRun ? 'Dry run: nothing was written.' : `Done, ${ran} migration(s) applied.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
