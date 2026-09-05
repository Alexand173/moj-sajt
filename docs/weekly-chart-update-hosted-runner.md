# Hosted weekly AI chart update

The weekly chart workflow is [`.github/workflows/update-music.yml`](../.github/workflows/update-music.yml). It runs on `ubuntu-latest`, so the local Windows PC and its desktop session do not need to be online.

## Windows test command

Use `npm test` rather than invoking the Vitest binary directly. [`scripts/run-vitest.mjs`](../scripts/run-vitest.mjs) resolves the canonical Windows workspace path before starting Vitest. This avoids Vitest 4 loading its runner twice when the IDE exposes the drive as `c:` while Windows resolves it as `C:`.

## Behavior that remains unchanged

The job still:

1. Opens the exact chart URL stored in [`scripts/ai_scraper.py`](../scripts/ai_scraper.py).
2. Uses OpenAI Vision on screenshots to read the visible table from top to bottom.
3. Scrolls through the virtualized table until the requested ordered ranks are collected.
4. Resolves official YouTube links with the YouTube Data API and the existing `yt-dlp` fallback.
5. Refuses incomplete charts, uploads complete rows to Supabase, and prunes stale rows only after validation.

No Soundcharts API is used. The browser is only the rendered page surface for the existing AI workflow.

## Required GitHub secrets

Keep these existing secrets:

- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `YOUTUBE_API_KEY`

Add:

- `SOUNDCHARTS_STORAGE_STATE_B64`

This new secret is a base64-encoded Playwright storage-state JSON for an authorized Soundcharts browser session. It contains session cookies and must be treated like a password.

## Create or refresh the browser session

Install the hosted scraper dependencies locally:

```powershell
python -m pip install -r scripts/requirements-ai-scraper.txt
python -m playwright install chromium
```

Run the interactive exporter:

```powershell
python scripts/export-soundcharts-storage-state.py
```

By default, the exporter reopens Chrome profile `Profile 1`, which is mapped locally to `okrenisebre@gmail.com`, after all Chrome windows are closed. It opens the immutable Germany Rock chart URL and reuses that profile's existing Google/Soundcharts cookies; it does not create an empty login session. Do not sign out. Confirm that the already-authenticated chart table is visible, then return to the terminal and press Enter. The exporter writes `.tmp/soundcharts-storage-state.json`.

If you must keep the current Chrome window open, start Chrome with remote debugging and use the optional CDP attach mode:

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --remote-debugging-port=9222 --profile-directory='Profile 1'
$env:SOUNDCHARTS_CHROME_CDP_URL = 'http://127.0.0.1:9222'
python scripts/export-soundcharts-storage-state.py
```

CDP mode connects to the existing tab and leaves Chrome open. If the login is stored in another profile, set it for the default profile-reopen mode:

```powershell
$env:SOUNDCHARTS_CHROME_PROFILE = 'Profile 1'
python scripts/export-soundcharts-storage-state.py
```

Create a base64 value without printing it to the terminal:

```powershell
$encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes('.tmp/soundcharts-storage-state.json'))
$encoded | gh secret set SOUNDCHARTS_STORAGE_STATE_B64 --repo Alexand173/moj-sajt
```

Alternatively, add the value in the repository's Actions secrets UI. Never commit the JSON or place it in a workflow log.

## Run and verify

Use `workflow_dispatch` with one preset first, for example `germany-rock`. The workflow restores the state into runner temp storage, installs Chromium, and runs the existing sequential updater.

Each preset artifact must contain:

- exactly 50 rows;
- ranks 1 through 50 with no duplicates or gaps;
- a resolved YouTube ID for every row;
- `uploaded_to_supabase: 50`;
- the original immutable `source_url`.

After the one-preset run succeeds, dispatch the full run with the preset input empty. The run summary and per-preset `chart-data.json`/`run.log` files are uploaded for 14 days.

## Session expiry recovery

If the workflow reports that Soundcharts redirected to authentication or the session expired:

1. Run the exporter again locally.
2. Complete the login and save a fresh storage state.
3. Replace `SOUNDCHARTS_STORAGE_STATE_B64`.
4. Re-run one preset before enabling the Sunday schedule again.

The workflow fails before writing a partial chart when the session, OpenAI, YouTube, or Supabase configuration is missing.

## Local fallback

The old physical-monitor path remains available for local rollback. Install its extra dependencies with:

```powershell
python -m pip install -r scripts/requirements-ai-scraper-local.txt
```

Leave `AI_SCRAPER_BROWSER_MODE` unset or set it to `local` for that path. Hosted GitHub Actions uses `AI_SCRAPER_BROWSER_MODE=hosted` and never imports the physical monitor path at runtime.

## Rollback

To roll back during the staged migration, restore the previous self-hosted runner workflow revision and keep the local requirements file available. Do not manually delete or replace Supabase chart rows; the existing complete-chart validation and stale-row pruning remain the data-safety boundary.
