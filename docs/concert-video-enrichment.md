# Concert video enrichment

The ticket hero reads `koncerti.video_url`. The scheduled GitHub Actions workflow in [`.github/workflows/enrich-concert-videos.yml`](../.github/workflows/enrich-concert-videos.yml) maintains that column independently from the Soundcharts chart updater.

## Selection rules

- Read the exact `artist_name` text from `koncerti`; that stored text is sent directly in the YouTube search query and remains the update filter value.
- Group rows by the exact stored `artist_name` value; different spellings remain separate artists.
- Search YouTube at most once for each exact artist name per run.
- Keep one canonical `https://www.youtube.com/watch?v=...` URL on one row per exact artist name.
- Clear `video_url` on every other row with the same exact `artist_name`.
- Preserve an existing YouTube URL when its YouTube publication date is within the last 365 days.
- Search YouTube once for each artist without a fresh existing URL.
- Restrict search results to videos published between now and 365 days ago, and request newest-first results.
- Reject reactions, covers, karaoke, tributes, fan uploads, unofficial uploads, bootlegs, parodies, and auditions.
- Require artist-name relevance plus tour, concert, live, performance, announcement, dates, festival, rehearsal, teaser, clip, or stage language.
- Cleanup-only mode clears duplicate URLs without calling YouTube and does not require `YOUTUBE_API_KEY`.
- Continue when one artist cannot be resolved; the run summary records updated, deduplicated, unresolved, and failed artists.

## Required GitHub secrets

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `YOUTUBE_API_KEY`

Apply [`supabase/migrations/20260912141000_add_koncerti_video_url.sql`](../supabase/migrations/20260912141000_add_koncerti_video_url.sql) to the Supabase project before the first workflow run.

The workflow runs daily at 01:15 UTC after the existing midnight concert sync and can also be dispatched manually with an optional unique-artist limit, an exact `artist_name` value, or `cleanup_only=true`. The default is 75 artists per run to stay within the YouTube Data API search quota. Run cleanup-only once after deployment to remove existing duplicate URLs for all exact artist names.
