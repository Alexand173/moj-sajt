"""Local AI-assisted chart capture utility.

This script is intentionally separate from the production Soundcharts API updater.
It opens a chart page, uses OpenAI Vision to locate filter controls, captures the
visible table, and writes the extracted rows to a JSON file.

Install the optional local dependencies first:
    python -m pip install -r scripts/requirements-ai-scraper.txt

Run from the repository root:
    python scripts/ai_scraper.py --region germany --country Any --genre Any --upload \
      --output-dir .tmp/ai-scraper
"""

from __future__ import annotations

import argparse
import base64
import json
from datetime import date
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import webbrowser
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urlencode, urlparse
from urllib.request import Request, urlopen

try:
    import mss
    from PIL import Image
except ImportError:  # pragma: no cover - reported by _require_runtime
    mss = None  # type: ignore[assignment]
    Image = None  # type: ignore[assignment,misc]

try:
    import openai
except ImportError:  # pragma: no cover - reported by _require_runtime
    openai = None  # type: ignore[assignment]

try:
    import yt_dlp
except ImportError:  # pragma: no cover - optional quota fallback
    yt_dlp = None  # type: ignore[assignment]

try:
    import pyautogui
except ImportError:  # pragma: no cover - reported by _require_runtime
    pyautogui = None  # type: ignore[assignment]

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - reported by _require_runtime
    load_dotenv = None  # type: ignore[assignment]


def _make_console_streams_unicode_safe() -> None:
    """Prevent UnicodeEncodeError crashes on Windows' legacy cp1252 console.

    Artist/song names routinely contain non-ASCII characters (accents,
    Turkish/German glyphs, emoji). Losing an entire batch of already-scraped
    rows to a print() crash is worse than replacing an unprintable glyph.
    """
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is not None and hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):
                pass


_make_console_streams_unicode_safe()


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]

# Soundcharts stores these filter states in immutable URLs. Keep every supplied
# chart URL here so manual runs always use the same source definition.
CHART_PRESET_URLS = {
    "germany-pop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREUiLCJmdHNnIjoicG9wIiwiZnJkIjoiTFRfNiIsImRzdHI6OmluIjpbIkFMTCJdLCJmYXJnIjoicG9wIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "germany-hip-hop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREUiLCJmdHNnIjoiaGlwIGhvcCIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6ImhpcCBob3AifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "germany-rock": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREUiLCJmdHNnIjoicm9jayIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6InJvY2sifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "germany-rb-soul": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREUiLCJmdHNnIjoiciZifHNvdWwiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJyJmJ8c291bCJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
    # The supplied “Germany country” URL has a Soundcharts `metal` filter.
    # It is stored under both labels for compatibility with the request.
   # "germany-country": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREUiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiIyMDI1LTEyLTIwfDIwMjYtMDgtMDgifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "germany-metal": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREUiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJtZXRhbCJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
    "germany-dance-electronic": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREUiLCJmdHNnIjoiZWRtfGVsZWN0cm8iLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJlZG18ZWxlY3RybyJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
}

CHART_PRESET_GENRES = {
    "germany-pop": "pop",
    "germany-hip-hop": "hip-hop",
    "germany-rock": "rock",
    "germany-rb-soul": "rb-soul",
    # The supplied "Germany country" URL actually decodes to Soundcharts'
    # `metal` filter, so both presets resolve to the Europa Metal genre.
    "germany-country": "metal",
    "germany-metal": "metal",
    "germany-dance-electronic": "dance-electronic",
}

DEFAULT_CHART_URL = CHART_PRESET_URLS["germany-pop"]


FRANCE_CHART_PRESET_URLS = {
    "france-pop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiRlIiLCJmdHNnIjoicG9wIiwiZnJkIjoiTFRfNiIsImRzdHI6OmluIjpbIkFMTCJdLCJmYXJnIjoicG9wIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "france-hip-hop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiRlIiLCJmdHNnIjoiaGlwIGhvcCIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6ImhpcCBob3AifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "france-rock": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiRlIiLCJmdHNnIjoicm9jayIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6InJvY2sifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "france-rb-soul": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiRlIiLCJmdHNnIjoiciZifHNvdWwiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJyJmJ8c291bCJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
  #  "france-country": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiRlIiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82In0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "france-metal": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiRlIiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJtZXRhbCJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
    "france-dance-electronic": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiRlIiLCJmdHNnIjoiZWRtfGVsZWN0cm8iLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJlZG18ZWxlY3RybyJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
}

FRANCE_CHART_PRESET_GENRES = {
    "france-pop": "pop",
    "france-hip-hop": "hip-hop",
    "france-rock": "rock",
    "france-rb-soul": "rb-soul",
   # "france-country": "metal",
    "france-metal": "metal",
    "france-dance-electronic": "dance-electronic",
}

ITALY_CHART_PRESET_URLS = {
    "italy-pop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiSVQiLCJmdHNnIjoicG9wIiwiZnJkIjoiTFRfNiIsImRzdHI6OmluIjpbIkFMTCJdLCJmYXJnIjoicG9wIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "italy-hip-hop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiSVQiLCJmdHNnIjoiaGlwIGhvcCIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6ImhpcCBob3AifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "italy-rock": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiSVQiLCJmdHNnIjoicm9jayIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6InJvY2sifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "italy-rb-soul": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiSVQiLCJmdHNnIjoiciZifHNvdWx8Ymx1ZXMiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJyJmJ8c291bHxibHVlcyJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
   # "italy-country": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiSVQiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82In0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "italy-metal": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiSVQiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJtZXRhbCJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
    "italy-dance-electronic": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiSVQiLCJmdHNnIjoiZWxlY3Ryb3xlZG0iLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJlZG18ZWxlY3RybyJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
}

ITALY_CHART_PRESET_GENRES = {
    "italy-pop": "pop",
    "italy-hip-hop": "hip-hop",
    "italy-rock": "rock",
    "italy-rb-soul": "rb-soul",
    # The legacy country label points to the supplied Italy metal filter.
    "italy-country": "metal",
    "italy-metal": "metal",
    "italy-dance-electronic": "dance-electronic",
}


def resolve_chart_preset(preset: str) -> tuple[str, str]:
    """Return the immutable Soundcharts URL and MusicTop genre for a preset."""
    normalized = preset.strip().lower()
    try:
        if normalized.startswith("france-"):
            return FRANCE_CHART_PRESET_URLS[normalized], FRANCE_CHART_PRESET_GENRES[normalized]
        if normalized.startswith("italy-"):
            return ITALY_CHART_PRESET_URLS[normalized], ITALY_CHART_PRESET_GENRES[normalized]
        if normalized.startswith("poland-"):
            return POLAND_CHART_PRESET_URLS[normalized], POLAND_CHART_PRESET_GENRES[normalized]
        return CHART_PRESET_URLS[normalized], CHART_PRESET_GENRES[normalized]
    except KeyError as error:
        supported = ", ".join(sorted({
            *CHART_PRESET_URLS,
            *FRANCE_CHART_PRESET_URLS,
            *ITALY_CHART_PRESET_URLS,
            *POLAND_CHART_PRESET_URLS,
        }))
        raise ScraperError(
            f"Unknown chart preset {preset!r}. Choose one of: {supported}."
        ) from error


# Backwards-compatible name retained for existing local invocations.
def resolve_germany_chart_preset(preset: str) -> tuple[str, str]:
    return resolve_chart_preset(preset)


DEFAULT_MODEL = "gpt-4.1-mini"
DEFAULT_PAGE_WAIT_SECONDS = 5.0
MAX_ACTION_RETRIES = 3
MAX_EXTRACTION_RETRIES = 2

GENRE_ID_BY_SLUG = {
    "rock": 1,
    "pop": 2,
    "hip-hop": 3,
    "rb-soul": 4,
    "country": 5,
    "dance-electronic": 6,
    "j-pop": 7,
    "j-rock-metal": 8,
    "k-pop": 9,
    "c-pop": 10,
    "india": 11,
    "other": 12,
    "jazz": 13,
    "classical": 14,
    "metal": 15,
}

REGION_NAMES = {
    "US",
    "UK",
    "LATINO",
    "GERMANY",
    "FRANCE",
    "ITALY",
    "POLAND",
    "NORDIC",
    "BALTIC",
    "BALKAN",
    "OTHER",
    "ASIA",
    "WORLD",
}

REGION_ARTIST_COUNTRIES = {
    "US": ["United States"],
    "UK": ["United Kingdom"],
    "GERMANY": ["Germany"],
    "FRANCE": ["France"],
    "ITALY": ["Italy"],
    "POLAND": ["Poland"],
    "NORDIC": ["Sweden", "Norway", "Denmark", "Finland", "Iceland"],
    "BALTIC": ["Estonia", "Latvia", "Lithuania"],
    "BALKAN": [
        "Albania", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Greece",
        "Montenegro", "North Macedonia", "Romania", "Serbia", "Slovenia",
    ],
    "OTHER": [
        "Austria", "Belgium", "Switzerland", "Cyprus", "Czechia", "Hungary",
        "Ireland", "Luxembourg", "Malta", "Netherlands", "Slovakia",
    ],
    "LATINO": ["Any"],
    "ASIA": ["Any"],
    "WORLD": ["Any"],
}
POLAND_CHART_PRESET_URLS = {
    "poland-pop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoicG9wIiwiZnJkIjoiTFRfNiIsImRzdHI6OmluIjpbIkFMTCJdLCJmYXJnIjoicG9wIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "poland-hip-hop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoiaGlwIGhvcCIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6ImhpcCBob3AifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "poland-rock": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoicm9jayIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6InJvY2sifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "poland-rb-soul": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoiciZifHNvdWwiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl19LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
  #  "poland-country": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiRlIiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82In0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "poland-metal": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJtZXRhbCJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
    "poland-dance-electronic": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoiZWxlY3Ryb3xlZG0iLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJlbGVjdHJvfGVkbSJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
}

POLAND_CHART_PRESET_GENRES = {
    "poland-pop": "pop",
    "poland-hip-hop": "hip-hop",
    "poland-rock": "rock",
    "poland-rb-soul": "rb-soul",
   # "poland-country": "metal",
    "poland-metal": "metal",
    "poland-dance-electronic": "dance-electronic",

}

NORDIC_CHART_PRESET_URLS = {
    "nordic-pop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREt8Rkl8SVN8Tk98U0UiLCJmdHNnIjoicG9wIiwiZnJkIjoiTFRfNiIsImZhcmciOiJwb3AifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "nordic-hip-hop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREt8Rkl8SVN8Tk98U0UiLCJmdHNnIjoiaGlwIGhvcCIsImZyZCI6IkxUXzYiLCJmYXJnIjoiaGlwIGhvcCJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
    "nordic-rock": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREt8Rkl8SVN8Tk98U0UiLCJmdHNnIjoicm9jayIsImZyZCI6IkxUXzYiLCJmYXJnIjoicm9jayJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
    "nordic-rb-soul": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREt8Rkl8SVN8Tk98U0UiLCJmdHNnIjoiciZifHNvdWwiLCJmcmQiOiJMVF82IiwiZmFyZyI6InImYnxzb3VsIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
  #  "nordic-country": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiRlIiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82In0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "nordic-metal": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREt8Rkl8SVN8Tk98U0UiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82IiwiZmFyZyI6Im1ldGFsIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "nordic-dance-electronic": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiREt8Rkl8SVN8Tk98U0UiLCJmdHNnIjoiZWRtfGVsZWN0cm8iLCJmcmQiOiJMVF82IiwiZmFyZyI6ImVkbXxlbGVjdHJvIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
}

NORDIC_CHART_PRESET_GENRES = {
    "nordic-pop": "pop",
    "nordic-hip-hop": "hip-hop",
    "nordic-rock": "rock",
    "nordic-rb-soul": "rb-soul",
   # "nordic-country": "metal",
    "nordic-metal": "metal",
    "nordic-dance-electronic": "dance-electronic",

}
BALTIC_CHART_PRESET_URLS = {
    "baltic-pop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoicG9wIiwiZnJkIjoiTFRfNiIsImRzdHI6OmluIjpbIkFMTCJdLCJmYXJnIjoicG9wIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "baltic-hip-hop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoiaGlwIGhvcCIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6ImhpcCBob3AifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "baltic-rock": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoicm9jayIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6InJvY2sifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "baltic-rb-soul": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoiciZifHNvdWwiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl19LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
  #  "baltic-country": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiRlIiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82In0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "baltic-metal": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJtZXRhbCJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
    "baltic-dance-electronic": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoiZWxlY3Ryb3xlZG0iLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJlbGVjdHJvfGVkbSJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
}

BALTIC_CHART_PRESET_GENRES = {
    "baltic-pop": "pop",
    "baltic-hip-hop": "hip-hop",
    "baltic-rock": "rock",
    "baltic-rb-soul": "rb-soul",
   # "baltic-country": "metal",
    "baltic-metal": "metal",
    "baltic-dance-electronic": "dance-electronic",

}
BALKAN_CHART_PRESET_URLS = {
    "balkan-pop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoicG9wIiwiZnJkIjoiTFRfNiIsImRzdHI6OmluIjpbIkFMTCJdLCJmYXJnIjoicG9wIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "balkan-hip-hop": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoiaGlwIGhvcCIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6ImhpcCBob3AifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "balkan-rock": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoicm9jayIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSwiZmFyZyI6InJvY2sifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D",
    "balkan-rb-soul": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoiciZifHNvdWwiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl19LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
  #  "balkan-country": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiRlIiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82In0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
    "balkan-metal": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiUEwiLCJmdHNnIjoibWV0YWwiLCJmcmQiOiJMVF82IiwiZHN0cjo6aW4iOlsiQUxMIl0sImZhcmciOiJtZXRhbCJ9LCJtaSI6W1siYXVkaWVuY2Uuc3BvdGlmeS50b3RhbCIseyJtbSI6IiJ9XV19",
    "balkan-dance-electronic": "https://app.soundcharts.com/app/market/tracks?filters=eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7ImZjIjoiQkF8SFJ8Qkd8TUt8UlN8U0l8TUUiLCJmdHNnIjoiZWRtfGVsZWN0cm8iLCJmcmQiOiJMVF82IiwiZmFyZyI6ImVkbXxlbGVjdHJvIn0sIm1pIjpbWyJhdWRpZW5jZS5zcG90aWZ5LnRvdGFsIix7Im1tIjoiIn1dXX0%3D",
}

BALKAN_CHART_PRESET_GENRES = {
    "balkan-pop": "pop",
    "balkan-hip-hop": "hip-hop",
    "balkan-rock": "rock",
    "balkan-rb-soul": "rb-soul",
   # "balkan-country": "metal",
    "balkan-metal": "metal",
    "balkan-dance-electronic": "dance-electronic",

}
class ScraperError(RuntimeError):
    """Raised when the local chart capture cannot continue safely."""


@dataclass(frozen=True)
class ScreenCapture:
    path: Path
    offset_x: int
    offset_y: int


@dataclass(frozen=True)
class ScraperConfig:
    model: str = DEFAULT_MODEL
    monitor_index: int = 1
    page_wait_seconds: float = DEFAULT_PAGE_WAIT_SECONDS
    action_retries: int = MAX_ACTION_RETRIES



def load_environment() -> None:
    """Load the repository environment without failing when dotenv is absent."""
    if load_dotenv is None:
        return

    local_env = REPOSITORY_ROOT / ".env.local"
    if local_env.exists():
        load_dotenv(local_env, override=False)
    else:
        load_dotenv(REPOSITORY_ROOT / ".env", override=False)



def open_chart_page(chart_url: str) -> None:
    """Open Soundcharts directly in Chrome on Windows, avoiding broken URL associations."""
    if os.name == "nt":
        candidates = [
            shutil.which("chrome.exe"),
            os.path.expandvars(r"%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"),
            os.path.expandvars(r"%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe"),
        ]
        chrome_path = next(
            (candidate for candidate in candidates if candidate and Path(candidate).exists()),
            None,
        )
        if chrome_path:
            subprocess.Popen([chrome_path, "--new-tab", chart_url])
            return

    if not webbrowser.open(chart_url):
        raise ScraperError("Could not open Soundcharts in a browser.")



def _require_runtime() -> None:
    missing: list[str] = []
    if openai is None:
        missing.append("openai")
    if mss is None or Image is None:
        missing.append("mss/Pillow")
    if pyautogui is None:
        missing.append("pyautogui")
    if not os.getenv("OPENAI_API_KEY", "").strip():
        missing.append("OPENAI_API_KEY")

    if missing:
        raise ScraperError(
            "Missing AI scraper requirements: "
            + ", ".join(missing)
            + ". Install scripts/requirements-ai-scraper.txt and configure .env.local."
        )



def create_openai_client() -> Any:
    _require_runtime()
    assert openai is not None
    return openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"].strip())



def _monitor_geometry(monitor_index: int) -> tuple[int, int, int, int]:
    assert mss is not None
    with mss.mss() as screenshotter:
        monitors = screenshotter.monitors
        if monitor_index < 1 or monitor_index >= len(monitors):
            raise ScraperError(
                f"Monitor {monitor_index} is unavailable. "
                f"Choose a value from 1 to {len(monitors) - 1}."
            )
        monitor = monitors[monitor_index]
        return (
            int(monitor["left"]),
            int(monitor["top"]),
            int(monitor["width"]),
            int(monitor["height"]),
        )



def take_screenshot(
    filename: str | Path = "screen.png",
    monitor_index: int = 1,
) -> str:
    """Capture one monitor and return the saved path for backwards compatibility."""
    return str(capture_screen(filename, monitor_index).path)



def capture_screen(filename: str | Path, monitor_index: int = 1) -> ScreenCapture:
    """Capture the selected monitor and retain its desktop coordinate offset."""
    _require_runtime()
    assert mss is not None
    assert Image is not None

    left, top, width, height = _monitor_geometry(monitor_index)
    destination = Path(filename).expanduser().resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)

    with mss.mss() as screenshotter:
        screenshot = screenshotter.grab(
            {"left": left, "top": top, "width": width, "height": height}
        )
        image = Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")
        image.save(destination)

    return ScreenCapture(destination, left, top)



def _image_as_data_url(image_path: str | Path) -> str:
    path = Path(image_path)
    if not path.exists():
        raise ScraperError(f"Screenshot does not exist: {path}")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"



def _strip_json_markdown(content: str) -> str:
    cleaned = content.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()



def _request_json(
    client: Any,
    *,
    model: str,
    system_prompt: str,
    user_prompt: str,
    image_path: str | Path,
    max_tokens: int,
    retries: int = 2,
) -> Any:
    """Ask Vision for JSON and retry transient/API formatting failures."""
    image_url = _image_as_data_url(image_path)
    last_error: Exception | None = None

    for attempt in range(retries + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {"type": "image_url", "image_url": {"url": image_url}},
                        ],
                    },
                ],
                temperature=0,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            if not content:
                raise ScraperError("OpenAI returned an empty Vision response.")
            return json.loads(_strip_json_markdown(content))
        except Exception as error:  # OpenAI exposes different exception types by SDK version.
            last_error = error
            if attempt >= retries:
                break
            time.sleep(1.5 * (attempt + 1))

    raise ScraperError(f"OpenAI Vision request failed: {last_error}") from last_error



def ask_ai_for_coordinates(
    image_path: str | Path,
    goal_description: str,
    *,
    client: Any | None = None,
    model: str = DEFAULT_MODEL,
) -> tuple[int, int]:
    """Find a safe click target in a screenshot using OpenAI Vision."""
    client = client or create_openai_client()
    result = _request_json(
        client,
        model=model,
        system_prompt=(
            "Return only a JSON object with integer x and y coordinates. "
            "Coordinates must be relative to the supplied screenshot. "
            "Never choose browser chrome, advertisements, or an unrelated control."
        ),
        user_prompt=(
            f"Locate the center of the UI control needed for: {goal_description}. "
            "Return {\"x\": number, \"y\": number}."
        ),
        image_path=image_path,
        max_tokens=80,
        retries=MAX_EXTRACTION_RETRIES,
    )

    try:
        x = int(result["x"])
        y = int(result["y"])
    except (KeyError, TypeError, ValueError) as error:
        raise ScraperError(f"Vision returned invalid coordinates: {result!r}") from error

    if x < 0 or y < 0:
        raise ScraperError(f"Vision returned negative coordinates: {x}, {y}")
    return x, y



def extract_table_data(
    image_path: str | Path,
    *,
    client: Any | None = None,
    model: str = DEFAULT_MODEL,
    max_rows: int | None = None,
) -> list[dict[str, Any]]:
    """Extract visible chart rows and normalize them to a JSON list."""
    client = client or create_openai_client()
    result = _request_json(
        client,
        model=model,
        system_prompt=(
            "Extract the visible song chart table. Return a JSON object with a "
            "single `rows` array. Each row should preserve ranking, title, artist "
            "text (omit country flag icons), genre tags, image/thumbnail URL when "
            "visible, and any visible platform metrics. Do not invent values."
        ),
        user_prompt=(
            "Read every visible table row. Use null for a field that is not visible. "
            "Return {\"rows\": [{\"rank\": 1, \"title\": \"...\", "
            "\"artist\": \"...\", \"genres\": [\"Pop\"]}]} and no commentary. "
            "Use the visible blue genre badges such as Pop, Hip Hop, Rock, "
            "Country, Electro, Alternative, Traditional, Folk, or Classical."
        ),
        image_path=image_path,
        max_tokens=2500,
        retries=MAX_EXTRACTION_RETRIES,
    )

    if isinstance(result, list):
        rows = result
    elif isinstance(result, dict) and isinstance(result.get("rows"), list):
        rows = result["rows"]
    else:
        raise ScraperError(f"Vision returned no chart rows: {result!r}")

    normalized = [row for row in rows if isinstance(row, dict)]
    if max_rows is not None:
        normalized = normalized[:max_rows]
    return normalized



def _normalize_label(value: Any) -> str:
    return str(value or "").strip()



def _slugify_genre(value: Any) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", _normalize_label(value).lower()).strip("-")
    aliases = {
        "hip-hop": "hip-hop",
        "hiphop": "hip-hop",
        "r-b-soul": "rb-soul",
        "rnb": "rb-soul",
        "dance": "dance-electronic",
        "electronic": "dance-electronic",
        "electro": "dance-electronic",
        "edm": "dance-electronic",
        "j-rock": "j-rock-metal",
        "metal": "j-rock-metal",
        "indian": "india",
        "alternative": "other",
        "traditional": "other",
        "folk": "other",
    }
    return aliases.get(normalized, normalized)



def _row_text(row: dict[str, Any], keys: Sequence[str]) -> str:
    for key in keys:
        value = row.get(key)
        if isinstance(value, (list, tuple)):
            text = " • ".join(_normalize_label(item) for item in value if _normalize_label(item))
        else:
            text = _normalize_label(value)
        if text:
            return text
    return ""



def _clean_artist_name(value: str) -> str:
    """Remove the country-flag glyphs visible beside artists in Soundcharts."""
    without_flags = re.sub(r"[\U0001F1E6-\U0001F1FF]+", "", value)
    return re.sub(r"\s{2,}", " ", without_flags).strip(" •|-\t")



def _resolve_genre_slug(row: dict[str, Any], default_genre: str) -> str:
    """Pick the first recognized MusicTop genre from one or more chart tags."""
    values: list[Any] = []
    for key in ("genre", "genres", "song_genre", "genre_tags", "tags", "labels"):
        value = row.get(key)
        if isinstance(value, (list, tuple)):
            values.extend(value)
        elif value:
            values.append(value)

    for value in values:
        slug = _slugify_genre(value)
        if slug in GENRE_ID_BY_SLUG:
            return slug

    return _slugify_genre(default_genre)



def _parse_rank(value: Any, fallback: int) -> int:
    match = re.search(r"\d+", _normalize_label(value))
    return int(match.group()) if match else fallback



def normalize_chart_rows(
    rows: Sequence[dict[str, Any]],
    *,
    region: str,
    default_genre: str = "Any",
    force_default_genre: bool = False,
) -> list[dict[str, Any]]:
    """Convert Vision rows into the songs-table fields without inventing names."""
    normalized_region = _normalize_label(region).upper()
    if normalized_region not in REGION_NAMES:
        raise ScraperError(
            f"Unsupported chart region {region!r}. Use one of: {', '.join(sorted(REGION_NAMES))}."
        )

    records: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        title = _row_text(row, ("title", "song", "song_name", "track"))
        artist = _clean_artist_name(_row_text(row, ("artist", "artist_name", "artists", "performer")))
        if not title or not artist:
            print(f"[AI Agent] Skipping row {index}: missing song title or artist.", file=sys.stderr)
            continue

        default_genre_slug = _normalize_label(default_genre).lower()
        genre_slug = (
            default_genre_slug
            if default_genre_slug in GENRE_ID_BY_SLUG
            else _slugify_genre(default_genre)
        ) if force_default_genre else _resolve_genre_slug(row, default_genre)
        if genre_slug == "any" or genre_slug not in GENRE_ID_BY_SLUG:
            print(
                f"[AI Agent] Skipping {artist} - {title}: genre is not one of the MusicTop genres.",
                file=sys.stderr,
            )
            continue

        records.append(
            {
                "rank": _parse_rank(row.get("rank", row.get("position")), index),
                "title": title,
                "artist_name": artist,
                "genre": genre_slug,
                "genre_id": GENRE_ID_BY_SLUG[genre_slug],
                "region": normalized_region,
                "slika_url": _row_text(row, ("image", "image_url", "thumbnail", "cover")),
            }
        )

    return sorted(records, key=lambda record: (record["rank"], record["title"].lower()))



def _http_json_request(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    body: Any | None = None,
    timeout: float = 30,
) -> Any:
    request_headers = {"Accept": "application/json", **(headers or {})}
    encoded_body = None
    if body is not None:
        encoded_body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")

    request = Request(url, data=encoded_body, headers=request_headers, method=method)
    try:
        with urlopen(request, timeout=timeout) as response:
            response_body = response.read()
    except HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise ScraperError(f"HTTP {error.code} from {url}: {details[:500]}") from error
    except URLError as error:
        raise ScraperError(f"Could not reach {url}: {error.reason}") from error

    if not response_body:
        return None
    try:
        return json.loads(response_body.decode("utf-8"))
    except json.JSONDecodeError as error:
        raise ScraperError(f"Invalid JSON response from {url}.") from error



YOUTUBE_FALLBACK_QUERY_LIMIT = 4
YOUTUBE_SEARCH_RESULT_LIMIT = 10
YOUTUBE_SEARCH_TIMEOUT_SECONDS = 20
YOUTUBE_MIN_MATCH_SCORE = 2


def _youtube_search_queries(artist_name: str, title: str) -> list[str]:
    """Build a bounded set of public-search queries for noisy chart metadata."""
    artist = re.sub(r"\s+", " ", artist_name).strip()
    track = re.sub(r"\s+", " ", title).strip()
    candidates = (
        f"{artist} {track} official",
        f"{artist} {track} official audio",
        f"{artist} {track} official music video",
        f"{track} {artist}",
        f"{artist} official",
    )
    return list(dict.fromkeys(query for query in candidates if query.strip()))[:YOUTUBE_FALLBACK_QUERY_LIMIT]



def _youtube_match_score(
    *,
    artist_name: str,
    title: str,
    video_title: Any,
    channel: Any,
) -> int:
    """Score a candidate without accepting unrelated search results."""
    artist_tokens = [token for token in re.findall(r"[a-z0-9]+", artist_name.lower()) if len(token) > 2]
    title_tokens = [token for token in re.findall(r"[a-z0-9]+", title.lower()) if len(token) > 2]
    normalized_title = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
    normalized_video_title = re.sub(
        r"[^a-z0-9]+",
        " ",
        _normalize_label(video_title).lower(),
    ).strip()
    requested_track = re.search(r"\btrack\s+(\d+)\s+(\d+)\b", normalized_title)
    if requested_track:
        candidate_track = re.search(r"\btrack\s+(\d+)\s+(\d+)\b", normalized_video_title)
        if not candidate_track or candidate_track.groups() != requested_track.groups():
            return -100

    haystack = f"{_normalize_label(video_title)} {_normalize_label(channel)}".lower()
    score = sum(token in haystack for token in artist_tokens)
    score += sum(token in haystack for token in title_tokens)
    score += 3 if "official" in haystack else 0
    score += 2 if "vevo" in haystack or "topic" in haystack else 0
    score -= 4 if any(word in haystack for word in ("reaction", "karaoke", "cover")) else 0
    return score



def _resolve_official_youtube_with_ytdlp(artist_name: str, title: str) -> tuple[str, str]:
    """Resolve a likely video through bounded public YouTube searches."""
    if yt_dlp is None:
        raise ScraperError(
            "The YouTube Data API quota is exhausted and yt-dlp is not installed. "
            "Install scripts/requirements-ai-scraper.txt."
        )

    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
        "noplaylist": True,
        "socket_timeout": YOUTUBE_SEARCH_TIMEOUT_SECONDS,
        "retries": 1,
        "extractor_retries": 1,
    }
    best_match: tuple[int, dict[str, Any], str] | None = None
    failures: list[str] = []
    queries = _youtube_search_queries(artist_name, title)

    for query_text in queries:
        query = f"ytsearch{YOUTUBE_SEARCH_RESULT_LIMIT}:{query_text}"
        try:
            with yt_dlp.YoutubeDL(options) as downloader:
                data = downloader.extract_info(query, download=False)
        except Exception as error:
            failures.append(f"{query_text}: {str(error)[:160]}")
            continue

        entries = data.get("entries", []) if isinstance(data, dict) else []
        for entry in entries:
            if not isinstance(entry, dict) or not entry.get("id"):
                continue
            score = _youtube_match_score(
                artist_name=artist_name,
                title=title,
                video_title=entry.get("title"),
                channel=entry.get("channel") or entry.get("uploader"),
            )
            if score < YOUTUBE_MIN_MATCH_SCORE:
                continue
            if best_match is None or score > best_match[0]:
                best_match = (score, entry, query_text)

        if best_match is not None and best_match[0] >= 5:
            break

    if best_match is None:
        detail = failures[-1] if failures else "all query variants returned no relevant video"
        raise ScraperError(
            f"No public YouTube result found for {artist_name} - {title} ({detail})."
        )

    score, selected, query_text = best_match
    video_id = str(selected["id"])
    thumbnails = selected.get("thumbnails")
    thumbnail = selected.get("thumbnail")
    if not thumbnail and isinstance(thumbnails, list):
        thumbnail = next(
            (
                item.get("url")
                for item in reversed(thumbnails)
                if isinstance(item, dict) and item.get("url")
            ),
            None,
        )
    thumbnail = thumbnail or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
    print(
        f"[AI Agent] YouTube public-search fallback used: {artist_name} - {title} "
        f"(score={score}, query={query_text!r})"
    )
    return video_id, str(thumbnail)



def resolve_official_youtube(
    artist_name: str,
    title: str,
    *,
    api_key: str | None = None,
) -> tuple[str, str]:
    """Resolve a likely official YouTube video and return (video_id, thumbnail)."""
    key = (api_key or os.getenv("YOUTUBE_API_KEY", "")).strip()
    query = f"{artist_name} {title} official"
    if not key:
        return _resolve_official_youtube_with_ytdlp(artist_name, title)

    params = urlencode(
        {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": "10",
            "key": key,
        }
    )
    try:
        data = _http_json_request(
            f"https://www.googleapis.com/youtube/v3/search?{params}",
            timeout=30,
        )
    except ScraperError as error:
        if "HTTP 429" not in str(error) and "quotaExceeded" not in str(error):
            raise
        return _resolve_official_youtube_with_ytdlp(artist_name, title)

    items = data.get("items", []) if isinstance(data, dict) else []
    if not items:
        return _resolve_official_youtube_with_ytdlp(artist_name, title)

    scored_items: list[tuple[int, dict[str, Any]]] = []
    for item in items:
        item_id = item.get("id", {}).get("videoId")
        snippet = item.get("snippet", {})
        score = _youtube_match_score(
            artist_name=artist_name,
            title=title,
            video_title=snippet.get("title"),
            channel=snippet.get("channelTitle"),
        )
        if item_id and score >= YOUTUBE_MIN_MATCH_SCORE:
            scored_items.append((score, item))

    if not scored_items:
        print(
            f"[AI Agent] YouTube API returned no relevant result for {artist_name} - {title}; "
            "trying public-search fallback."
        )
        return _resolve_official_youtube_with_ytdlp(artist_name, title)

    _, selected = max(scored_items, key=lambda item: item[0])
    video_id = selected["id"]["videoId"]
    thumbnails = selected.get("snippet", {}).get("thumbnails", {})
    thumbnail = (
        thumbnails.get("high", {}).get("url")
        or thumbnails.get("medium", {}).get("url")
        or thumbnails.get("default", {}).get("url")
        or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
    )
    return video_id, thumbnail



def deduplicate_chart_records(records: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """Prevent duplicate constrained keys from breaking one Supabase upsert batch."""
    unique: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, int]] = set()
    for record in records:
        key = (
            record["title"].strip().casefold(),
            record["artist_name"].strip().casefold(),
            record["region"],
            int(record["genre_id"]),
        )
        if key in seen:
            print(
                f"[AI Agent] Skipping duplicate chart row: {record['artist_name']} - {record['title']}",
                file=sys.stderr,
            )
            continue
        seen.add(key)
        unique.append(record)
    return unique



def validate_uploaded_chart_records(
    records: Sequence[dict[str, Any]],
    *,
    target_rows: int,
) -> None:
    """Refuse to write a partial chart to Supabase."""
    if target_rows < 1:
        raise ScraperError("target_rows must be greater than zero.")

    expected_ranks = set(range(1, target_rows + 1))
    ranks: list[int] = []
    rank_counts: dict[int, int] = {}
    invalid_ranks: list[int] = []
    rows_without_youtube = 0

    for record in records:
        try:
            rank = int(record.get("rank"))
        except (TypeError, ValueError):
            invalid_ranks.append(-1)
            continue

        ranks.append(rank)
        rank_counts[rank] = rank_counts.get(rank, 0) + 1
        if rank not in expected_ranks:
            invalid_ranks.append(rank)
        if not str(record.get("youtube_id") or "").strip():
            rows_without_youtube += 1

    missing_ranks = sorted(expected_ranks - set(ranks))
    duplicate_ranks = sorted(rank for rank, count in rank_counts.items() if count > 1)
    invalid_ranks = sorted(set(invalid_ranks))

    if (
        len(records) != target_rows
        or missing_ranks
        or duplicate_ranks
        or invalid_ranks
        or rows_without_youtube
    ):
        raise ScraperError(
            "Refusing Supabase upload for incomplete chart: "
            f"expected {target_rows} rows, got {len(records)}; "
            f"missing ranks={missing_ranks}, duplicate ranks={duplicate_ranks}, "
            f"invalid ranks={invalid_ranks}, rows without YouTube ID={rows_without_youtube}."
        )



def enrich_song_records_with_youtube(records: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    """Resolve embeds while retaining unresolved ranked rows for diagnostics."""
    enriched: list[dict[str, Any]] = []
    for record in records:
        try:
            video_id, thumbnail = resolve_official_youtube(
                record["artist_name"],
                record["title"],
            )
        except ScraperError as error:
            print(
                f"[AI Agent] YouTube unresolved for {record['artist_name']} - "
                f"{record['title']}: {error}",
                file=sys.stderr,
            )
            enriched.append(
                {
                    **record,
                    "youtube_id": "",
                    "youtube_embed_url": None,
                    "youtube_resolution": "unresolved",
                    "youtube_error": str(error),
                }
            )
            continue

        enriched.append(
            {
                **record,
                "youtube_id": video_id,
                "slika_url": record.get("slika_url") or thumbnail,
                "youtube_embed_url": f"https://www.youtube.com/embed/{video_id}",
                "youtube_resolution": "resolved",
            }
        )
        print(f"[AI Agent] YouTube embed found: {record['artist_name']} - {record['title']}")
    return enriched



def _song_payloads(records: Sequence[dict[str, Any]], *, year: int) -> list[dict[str, Any]]:
    """Build only columns already consumed by the existing songs table."""
    payloads: list[dict[str, Any]] = []
    for record in records:
        rank = int(record["rank"])
        payloads.append(
            {
                "title": record["title"],
                "artist_name": record["artist_name"],
                "slika_url": record["slika_url"],
                "youtube_id": record["youtube_id"],
                "region": record["region"],
                "genre_id": record["genre_id"],
                "genre": record["genre"],
                "year": year,
                "is_chart": True,
                # Existing pages sort by viewers; this deterministic score keeps
                # the Soundcharts rank without assuming a new DB column exists.
                "viewers": max(0, 100_000 - rank),
            }
        )
    return payloads



def upsert_songs_to_supabase(
    records: Sequence[dict[str, Any]],
    *,
    year: int | None = None,
    chunk_size: int = 50,
) -> int:
    """Upsert resolved songs through Supabase REST using the service-role key."""
    supabase_url = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip().rstrip("/")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supabase_url or not service_role_key:
        raise ScraperError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for upload.")
    if chunk_size < 1:
        raise ScraperError("Supabase chunk_size must be greater than zero.")

    payloads = _song_payloads(records, year=year or date.today().year)
    endpoint = (
        f"{supabase_url}/rest/v1/songs?"
        f"{urlencode({'on_conflict': 'title,artist_name,region,genre_id'})}"
    )
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }

    uploaded = 0
    for start in range(0, len(payloads), chunk_size):
        chunk = payloads[start : start + chunk_size]
        _http_json_request(endpoint, method="POST", headers=headers, body=chunk, timeout=45)
        uploaded += len(chunk)
        print(f"[AI Agent] Supabase songs upserted: {uploaded}/{len(payloads)}")
    return uploaded



def prune_stale_chart_rows(records: Sequence[dict[str, Any]]) -> int:
    """Remove rows that fell out of one successfully captured chart partition."""
    if not records:
        raise ScraperError("Cannot prune a chart partition without records.")

    region = _normalize_label(records[0].get("region")).upper()
    try:
        genre_id = int(records[0].get("genre_id"))
    except (TypeError, ValueError) as error:
        raise ScraperError("Cannot prune a chart partition without a genre ID.") from error

    expected_keys = {
        (
            _normalize_label(record.get("title")).casefold(),
            _normalize_label(record.get("artist_name")).casefold(),
        )
        for record in records
    }
    if any(
        _normalize_label(record.get("region")).upper() != region
        or int(record.get("genre_id")) != genre_id
        for record in records
    ):
        raise ScraperError("Cannot prune a mixed region or genre chart partition.")

    supabase_url = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip().rstrip("/")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not supabase_url or not service_role_key:
        raise ScraperError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for pruning.")

    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Prefer": "return=minimal",
    }
    select_query = urlencode({
        "select": "id,title,artist_name",
        "region": f"eq.{region}",
        "genre_id": f"eq.{genre_id}",
        "limit": "1000",
    })
    existing = _http_json_request(
        f"{supabase_url}/rest/v1/songs?{select_query}",
        headers=headers,
        timeout=45,
    )
    if not isinstance(existing, list):
        raise ScraperError("Supabase returned an invalid chart partition while pruning.")

    stale_ids = [
        row.get("id")
        for row in existing
        if isinstance(row, dict)
        and (
            _normalize_label(row.get("title")).casefold(),
            _normalize_label(row.get("artist_name")).casefold(),
        ) not in expected_keys
        and row.get("id")
    ]
    for stale_id in stale_ids:
        delete_query = urlencode({"id": f"eq.{stale_id}"})
        _http_json_request(
            f"{supabase_url}/rest/v1/songs?{delete_query}",
            method="DELETE",
            headers=headers,
            timeout=45,
        )

    if stale_ids:
        print(f"[AI Agent] Removed {len(stale_ids)} stale rows from {region} genre_id={genre_id}.")
    return len(stale_ids)



def _click_target(
    capture: ScreenCapture,
    goal: str,
    *,
    client: Any,
    config: ScraperConfig,
) -> ScreenCapture:
    """Ask Vision for a target, click it, and return a fresh screenshot."""
    x, y = ask_ai_for_coordinates(
        capture.path,
        goal,
        client=client,
        model=config.model,
    )
    pyautogui.click(capture.offset_x + x, capture.offset_y + y)  # type: ignore[union-attr]
    time.sleep(0.8)
    return capture_screen(capture.path, config.monitor_index)



def _type_into_target(
    capture: ScreenCapture,
    goal: str,
    value: str,
    *,
    client: Any,
    config: ScraperConfig,
) -> ScreenCapture:
    """Click a text field, replace its value, and return the refreshed screen."""
    x, y = ask_ai_for_coordinates(
        capture.path,
        goal,
        client=client,
        model=config.model,
    )
    pyautogui.click(capture.offset_x + x, capture.offset_y + y)  # type: ignore[union-attr]
    pyautogui.hotkey("ctrl", "a")
    pyautogui.write(value, interval=0.03)
    pyautogui.press("enter")
    time.sleep(0.8)
    return capture_screen(capture.path, config.monitor_index)



def _select_dropdown_filter(
    capture: ScreenCapture,
    field_name: str,
    value: str,
    *,
    client: Any,
    config: ScraperConfig,
) -> ScreenCapture:
    """Set a Soundcharts dropdown, including the explicit `Any` state."""
    capture = _click_target(
        capture,
        f"the {field_name} dropdown/filter control, not the table",
        client=client,
        config=config,
    )

    if value.strip().lower() == "any":
        option_goal = f"the exact `Any` option in the open {field_name} dropdown"
    else:
        capture = _type_into_target(
            capture,
            f"the search input inside the open {field_name} dropdown",
            value,
            client=client,
            config=config,
        )
        option_goal = f"the exact `{value}` option in the open {field_name} dropdown"

    return _click_target(capture, option_goal, client=client, config=config)



def _artist_country_options(region: str, country: str) -> list[str]:
    """Resolve a region into one or more Soundcharts Artist country values."""
    requested = country.strip()
    if requested and requested.lower() != "any":
        return [requested]
    return REGION_ARTIST_COUNTRIES.get(region.upper(), ["Any"])



def _select_artist_country(
    capture: ScreenCapture,
    region: str,
    country: str,
    *,
    client: Any,
    config: ScraperConfig,
) -> ScreenCapture:
    """Select one country or all countries belonging to an Europa subregion."""
    options = _artist_country_options(region, country)
    if options == ["Any"]:
        return _select_dropdown_filter(
            capture,
            "Artist country",
            "Any",
            client=client,
            config=config,
        )

    capture = _click_target(
        capture,
        "the Artist country dropdown/filter control",
        client=client,
        config=config,
    )
    for index, option in enumerate(options):
        if index > 0:
            capture = _click_target(
                capture,
                "the Artist country dropdown/filter control",
                client=client,
                config=config,
            )
        capture = _type_into_target(
            capture,
            "the search input inside the open Artist country dropdown",
            option,
            client=client,
            config=config,
        )
        capture = _click_target(
            capture,
            f"the exact `{option}` option in the open Artist country dropdown",
            client=client,
            config=config,
        )

    return capture



def _select_stream_range(
    capture: ScreenCapture,
    *,
    client: Any,
    config: ScraperConfig,
) -> ScreenCapture:
    """Set the requested inclusive stream range: 1K through 5.5B."""
    capture = _click_target(
        capture,
        "the Streams filter control showing the stream range selector",
        client=client,
        config=config,
    )
    return _click_target(
        capture,
        "the exact `1K - 5.5B` stream range option in the open selector",
        client=client,
        config=config,
    )



def _select_release_date_range(
    capture: ScreenCapture,
    start_date: str,
    end_date: str,
    *,
    client: Any,
    config: ScraperConfig,
) -> ScreenCapture:
    """Set Release date to Custom range and fill its two date fields."""
    capture = _click_target(
        capture,
        "the Release date filter control",
        client=client,
        config=config,
    )
    capture = _click_target(
        capture,
        "the exact `Custom range` option in the open Release date selector",
        client=client,
        config=config,
    )
    capture = _type_into_target(
        capture,
        "the Custom range start-date input; use the first date field",
        start_date,
        client=client,
        config=config,
    )
    return _type_into_target(
        capture,
        "the Custom range end-date input; use the second date field",
        end_date,
        client=client,
        config=config,
    )



def _release_date_range(today: date | None = None) -> tuple[str, str]:
    """Return Dec 20 of the previous year through today's date in ISO format."""
    current_day = today or date.today()
    return date(current_day.year - 1, 12, 20).isoformat(), current_day.isoformat()



def decode_soundcharts_filters(chart_url: str) -> dict[str, Any]:
    """Decode the supplied Soundcharts URL filter payload for audit output."""
    raw_filter = parse_qs(urlparse(chart_url).query).get("filters", [""])[0]
    if not raw_filter:
        return {}

    try:
        padded = raw_filter + ("=" * (-len(raw_filter) % 4))
        decoded = base64.urlsafe_b64decode(unquote(padded)).decode("utf-8")
        value = json.loads(decoded)
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ScraperError(f"Could not decode Soundcharts filters from chart URL: {error}") from error

    if not isinstance(value, dict):
        raise ScraperError("Soundcharts filter payload must be a JSON object.")
    return value



def extract_chart_pages(
    first_capture: ScreenCapture,
    *,
    output_dir: Path,
    client: Any,
    config: ScraperConfig,
    target_rows: int,
) -> list[dict[str, Any]]:
    """Scroll through the Soundcharts table until the requested ranked rows exist."""
    if target_rows < 1:
        raise ScraperError("target_rows must be greater than zero.")

    all_rows: list[dict[str, Any]] = []
    seen_ranks: set[int] = set()
    unchanged_pages = 0
    capture = first_capture

    for page_number in range(1, 20):
        page_path = output_dir / f"table-{page_number:02d}.png"
        if page_number == 1:
            page_path = output_dir / "table.png"

        page_rows: list[dict[str, Any]] = []
        capture = first_capture
        for wait_attempt in range(1, 7):
            capture = capture_screen(page_path, config.monitor_index)
            page_rows = extract_table_data(
                capture.path,
                client=client,
                model=config.model,
                max_rows=None,
            )
            if page_rows:
                break
            print(
                f"[AI Agent] Soundcharts table is still loading "
                f"(attempt {wait_attempt}/6)..."
            )
            time.sleep(2)

        new_rows = 0
        for row in page_rows:
            title = _row_text(row, ("title", "song", "song_name", "track"))
            artist = _clean_artist_name(_row_text(row, ("artist", "artist_name", "artists", "performer")))
            rank = _parse_rank(row.get("rank", row.get("position")), len(all_rows) + 1)
            if title and artist and rank not in seen_ranks:
                seen_ranks.add(rank)
                all_rows.append(row)
                new_rows += 1

        print(
            f"[AI Agent] Chart page {page_number}: {len(page_rows)} visible rows, "
            f"{new_rows} new rows, {len(all_rows)}/{target_rows} collected."
        )
        unchanged_pages = unchanged_pages + 1 if new_rows == 0 else 0
        if len(all_rows) >= target_rows or unchanged_pages >= 4:
            break

        # Soundcharts virtualizes the table. Give the table body focus first;
        # mouse-wheel scrolling can leave the rows unchanged on this page.
        screen_width, screen_height = pyautogui.size()  # type: ignore[union-attr]
        pyautogui.click(int(screen_width * 0.35), int(screen_height * 0.70))  # type: ignore[union-attr]
        pyautogui.press("pagedown")  # type: ignore[union-attr]
        time.sleep(2)

    return all_rows[:target_rows]



def fetch_chartmetric_data(
    country: str = "Any",
    genre: str = "Any",
    chart_url: str = DEFAULT_CHART_URL,
    *,
    region: str = "WORLD",
    output_dir: str | Path | None = None,
    config: ScraperConfig | None = None,
    max_rows: int | None = 50,
    today: date | None = None,
    resolve_youtube: bool = True,
    upload: bool = False,
    replace_chart: bool = False,
    apply_filters: bool = False,
    force_default_genre: bool = False,
) -> list[dict[str, Any]]:
    """Capture a filtered Soundcharts table and return its extracted rows.

    By default the supplied Soundcharts URL is treated as the source of truth:
    no filters are clicked or changed. Pass `apply_filters=True` only when a URL
    does not already contain the desired filters. The visible table is paged by
    scrolling until the requested ranked rows are collected.

    The legacy function name is retained so existing local scripts can continue
    calling it. When `upload=True`, the resolved rows are persisted to the
    existing `songs` table through Supabase REST; the TypeScript updater remains
    unchanged.
    """
    _require_runtime()
    assert pyautogui is not None
    normalized_region = _normalize_label(region).upper()
    if normalized_region not in REGION_NAMES or normalized_region == "EUROPA":
        raise ScraperError(
            "Use a concrete MusicTop region/subregion for upload, not EUROPA itself: "
            + ", ".join(sorted(REGION_NAMES - {"EUROPA"}))
        )
    country_options = _artist_country_options(normalized_region, country)
    if upload and not resolve_youtube:
        raise ScraperError("Upload requires official YouTube resolution; remove --no-youtube.")

    config = config or ScraperConfig()
    client = create_openai_client()

    if output_dir is None:
        output_path = Path(tempfile.mkdtemp(prefix="musictop-ai-scraper-"))
    else:
        output_path = Path(output_dir).expanduser().resolve()
        output_path.mkdir(parents=True, exist_ok=True)

    print(f"[AI Agent] Opening chart page: {chart_url}")
    open_chart_page(chart_url)
    time.sleep(max(config.page_wait_seconds, 0))

    initial_capture = capture_screen(output_path / "initial.png", config.monitor_index)
    release_start, release_end = _release_date_range(today)
    if apply_filters:
        capture = _click_target(
            initial_capture,
            "the '+ Add filters' button or filter icon for the chart table",
            client=client,
            config=config,
        )
        capture = _select_artist_country(
            capture,
            normalized_region,
            country,
            client=client,
            config=config,
        )
        capture = _select_dropdown_filter(
            capture,
            "Song genres",
            genre,
            client=client,
            config=config,
        )
        capture = _select_stream_range(capture, client=client, config=config)
        capture = _select_release_date_range(
            capture,
            release_start,
            release_end,
            client=client,
            config=config,
        )

        try:
            capture = _click_target(
                capture,
                "the Apply, Done, or Show results button in the filter panel",
                client=client,
                config=config,
            )
        except ScraperError:
            # Some Soundcharts layouts apply the filter when Enter is pressed.
            pyautogui.press("escape")
            time.sleep(1)

        time.sleep(max(config.page_wait_seconds, 1))

    target_rows = max_rows or 50
    rows = extract_chart_pages(
        initial_capture,
        output_dir=output_path,
        client=client,
        config=config,
        target_rows=target_rows,
    )
    normalized_records = normalize_chart_rows(
        rows,
        region=normalized_region,
        default_genre=genre,
        force_default_genre=force_default_genre,
    )
    chart_records = deduplicate_chart_records(normalized_records)
    if resolve_youtube:
        chart_records = enrich_song_records_with_youtube(chart_records)

    uploaded = 0
    pruned_stale_rows = 0
    soundcharts_filters = decode_soundcharts_filters(chart_url)
    result_path = output_path / "chart-data.json"
    artifact = {
        "region": normalized_region,
        "filter_interaction": "applied_by_scraper" if apply_filters else "skipped_existing_url_filters",
        "filters": soundcharts_filters,
        "source_url": chart_url,
        "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "rows": chart_records,
        "uploaded_to_supabase": uploaded,
        "pruned_stale_rows": pruned_stale_rows,
    }

    def write_artifact() -> None:
        artifact["uploaded_to_supabase"] = uploaded
        artifact["pruned_stale_rows"] = pruned_stale_rows
        result_path.write_text(
            json.dumps(artifact, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    try:
        if upload:
            validate_uploaded_chart_records(chart_records, target_rows=target_rows)
            uploaded = upsert_songs_to_supabase(chart_records, year=(today or date.today()).year)
            if replace_chart:
                pruned_stale_rows = prune_stale_chart_rows(chart_records)
    finally:
        # Keep the full ranked capture available even when strict upload validation fails.
        write_artifact()

    print(
        f"[AI Agent] Extracted {len(chart_records)} chart rows -> {result_path} "
        f"(uploaded: {uploaded})"
    )
    return chart_records



def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Extract a Soundcharts chart with OpenAI Vision.")
    parser.add_argument("--region", default="WORLD", help="MusicTop region/subregion for Supabase rows")
    parser.add_argument("--country", default="Any", help="Artist country filter value")
    parser.add_argument("--genre", help="Song genres filter value")
    parser.add_argument(
        "--preset",
        choices=sorted({
            *CHART_PRESET_URLS,
            *FRANCE_CHART_PRESET_URLS,
            *ITALY_CHART_PRESET_URLS,
            *POLAND_CHART_PRESET_URLS,
        }),
        help="Use one of the immutable Germany, France, Italy, or Poland Soundcharts chart presets",
    )
    parser.add_argument("--chart-url", help="Chart page URL; overrides the default Pop URL")
    parser.add_argument("--output-dir", help="Directory for screenshots and chart-data.json")
    parser.add_argument("--upload", action="store_true", help="Upsert resolved rows into Supabase songs")
    parser.add_argument(
        "--replace-chart",
        action="store_true",
        help="After a complete upload, remove rows that fell out of this region/genre chart",
    )
    parser.add_argument(
        "--apply-filters",
        action="store_true",
        help="Ignore URL filter state and apply the CLI filter controls instead",
    )
    parser.add_argument(
        "--no-youtube",
        action="store_true",
        help="Skip official YouTube resolution; cannot be used together with --upload",
    )
    parser.add_argument("--model", default=os.getenv("OPENAI_MODEL", DEFAULT_MODEL))
    parser.add_argument("--monitor", type=int, default=1, help="1-based monitor index")
    parser.add_argument(
        "--wait-seconds",
        type=float,
        default=DEFAULT_PAGE_WAIT_SECONDS,
        help="Seconds to wait after opening/applying filters",
    )
    parser.add_argument("--max-rows", type=int, help="Optional maximum number of rows to save")
    return parser



def main(argv: Sequence[str] | None = None) -> int:
    load_environment()
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        preset_genre = None
        preset_url = None
        preset_region = None
        if args.preset:
            preset_url, preset_genre = resolve_chart_preset(args.preset)
            preset_region = args.preset.split("-", 1)[0].upper()

        rows = fetch_chartmetric_data(
            country=args.country,
            genre=args.genre or preset_genre or "Any",
            chart_url=args.chart_url or preset_url or DEFAULT_CHART_URL,
            region=preset_region or args.region,
            output_dir=args.output_dir,
            resolve_youtube=not args.no_youtube,
            upload=args.upload,
            replace_chart=args.replace_chart,
            apply_filters=args.apply_filters,
            force_default_genre=bool(args.preset),
            config=ScraperConfig(
                model=args.model,
                monitor_index=args.monitor,
                page_wait_seconds=args.wait_seconds,
            ),
            max_rows=args.max_rows,
        )
        print(json.dumps(rows, ensure_ascii=False, indent=2))
        return 0
    except KeyboardInterrupt:
        print("[AI Agent] Cancelled by user.", file=sys.stderr)
        return 130
    except ScraperError as error:
        print(f"[AI Agent] Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
