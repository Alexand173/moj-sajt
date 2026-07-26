## Changes Made

### 1. Added Next.js environment bootstrap for direct execution
- **File:** `app/api/scrape-official/route.ts`
- **Change:** Added `loadEnvConfig` from `@next/env` and invoke it only when the file is executed directly. The Supabase client is created after the bootstrap.
- **Why:** `npx tsx app/api/scrape-official/route.ts` does not automatically load `.env.local`, causing an empty Supabase URL/key and an immediate crash.
- **Revert:** Remove the `@next/env` import, `isDirectScript` declaration, and conditional `loadEnvConfig` block.

### 2. Reused the direct-execution guard and avoided forced process termination
- **File:** `app/api/scrape-official/route.ts`
- **Change:** Reused `isDirectScript` for the runner block and set `process.exitCode` instead of calling `process.exit()`.
- **Why:** Keeps the standalone command's success/failure status for GitHub Actions while allowing pending async/network handles to close cleanly on Windows.
- **Revert:** Restore the inline `require.main` check and explicit `process.exit()` calls.

### 3. Declared the environment loader as a runtime dependency
- **Files:** `package.json`, `package-lock.json`
- **Change:** Added `@next/env` version `16.2.2`, matching the installed Next.js version.
- **Why:** Makes the direct script's environment bootstrap explicit and reliable in clean CI installs.
- **Revert:** Remove the direct dependency and corresponding lockfile entry.

## Verification
- `npm test` — passed, 8 tests.
- `npx tsc --noEmit` — passed after final edit.
- `npm run build` — passed.
- `git diff --check` — passed; only existing line-ending normalization warnings were reported.
- Direct command reached Supabase and completed successfully: `146` official rows synchronized, with no AI enrichment call. The previous Windows assertion caused by forced process termination was removed.

## Revert Status
- [ ] Change 1
- [ ] Change 2
- [ ] Change 3
