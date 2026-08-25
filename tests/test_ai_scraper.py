from __future__ import annotations

import unittest
from unittest.mock import patch

import scripts.ai_scraper as scraper


class FakeYoutubeDL:
    calls: list[str] = []
    responses: list[dict] = []

    def __init__(self, options: dict):
        self.options = options

    def __enter__(self) -> "FakeYoutubeDL":
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        return False

    def extract_info(self, query: str, download: bool = False) -> dict:
        self.__class__.calls.append(query)
        return self.__class__.responses.pop(0)


class AiScraperFallbackTests(unittest.TestCase):
    def setUp(self) -> None:
        FakeYoutubeDL.calls.clear()
        FakeYoutubeDL.responses.clear()

    def test_public_search_retries_query_variants_and_scores_result(self) -> None:
        FakeYoutubeDL.responses.extend(
            [
                {"entries": []},
                {
                    "entries": [
                        {
                            "id": "resolved-video",
                            "title": "Artist Name - Track Title (Official Video)",
                            "channel": "Artist Name - Topic",
                            "thumbnail": "https://img.test/resolved.jpg",
                        }
                    ]
                },
            ]
        )

        with patch.object(scraper, "yt_dlp", type("FakeYtDlp", (), {"YoutubeDL": FakeYoutubeDL})):
            video_id, thumbnail = scraper.resolve_official_youtube(
                "Artist Name",
                "Track Title",
                api_key="",
            )

        self.assertEqual(video_id, "resolved-video")
        self.assertEqual(thumbnail, "https://img.test/resolved.jpg")
        self.assertEqual(len(FakeYoutubeDL.calls), 2)
        self.assertTrue(all(query.startswith("ytsearch10:") for query in FakeYoutubeDL.calls))

    def test_irrelevant_api_results_use_public_search_fallback(self) -> None:
        FakeYoutubeDL.responses.append(
            {
                "entries": [
                    {
                        "id": "fallback-video",
                        "title": "Artist Name - Track Title Official Audio",
                        "channel": "Artist Name - Topic",
                    }
                ]
            }
        )
        api_response = {
            "items": [
                {
                    "id": {"videoId": "unrelated-video"},
                    "snippet": {
                        "title": "Unrelated result",
                        "channelTitle": "Unrelated channel",
                    },
                }
            ]
        }

        with (
            patch.object(scraper, "yt_dlp", type("FakeYtDlp", (), {"YoutubeDL": FakeYoutubeDL})),
            patch.object(scraper, "_http_json_request", return_value=api_response),
        ):
            video_id, _ = scraper.resolve_official_youtube(
                "Artist Name",
                "Track Title",
                api_key="fake-key",
            )

        self.assertEqual(video_id, "fallback-video")
        self.assertEqual(len(FakeYoutubeDL.calls), 1)

    def test_numbered_placeholder_titles_require_the_exact_track_pair(self) -> None:
        wrong_score = scraper._youtube_match_score(
            artist_name="Die Toten Hosen",
            title="Track 2-9",
            video_title="Die Toten Hosen - Track 2-5 (Official Audio)",
            channel="Die Toten Hosen",
        )
        right_score = scraper._youtube_match_score(
            artist_name="Die Toten Hosen",
            title="Track 2-9",
            video_title="Die Toten Hosen - Track 2-9 (Official Audio)",
            channel="Die Toten Hosen",
        )

        self.assertLess(wrong_score, scraper.YOUTUBE_MIN_MATCH_SCORE)
        self.assertGreaterEqual(right_score, scraper.YOUTUBE_MIN_MATCH_SCORE)

    def test_unresolved_rows_are_retained_but_upload_validation_rejects_them(self) -> None:
        def resolve(artist_name: str, title: str) -> tuple[str, str]:
            if title == "Missing Track":
                raise scraper.ScraperError("no valid public result")
            return "resolved-video", "https://img.test/resolved.jpg"

        records = [
            {"rank": 1, "artist_name": "Artist", "title": "Found Track"},
            {"rank": 2, "artist_name": "Artist", "title": "Missing Track"},
        ]

        with patch.object(scraper, "resolve_official_youtube", side_effect=resolve):
            enriched = scraper.enrich_song_records_with_youtube(records)

        self.assertEqual([record["rank"] for record in enriched], [1, 2])
        self.assertEqual(enriched[0]["youtube_id"], "resolved-video")
        self.assertEqual(enriched[0]["youtube_resolution"], "resolved")
        self.assertEqual(enriched[1]["youtube_id"], "")
        self.assertEqual(enriched[1]["youtube_resolution"], "unresolved")
        self.assertIsNone(enriched[1]["youtube_embed_url"])

        with self.assertRaisesRegex(scraper.ScraperError, "rows without YouTube ID=1"):
            scraper.validate_uploaded_chart_records(enriched, target_rows=2)


if __name__ == "__main__":
    unittest.main()
