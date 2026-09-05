"""Export a manually authenticated Soundcharts Playwright storage state.

Run locally, complete the login in the visible browser, and press Enter after
the chart page is accessible. Treat the output as a password and never commit
or print it.
"""

from __future__ import annotations

import os
from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT = Path(".tmp/soundcharts-storage-state.json")
CHROME_USER_DATA_DIR = Path(
    os.getenv("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))
) / "Google" / "Chrome" / "User Data"
CHROME_PROFILE_DIR = os.getenv("SOUNDCHARTS_CHROME_PROFILE", "Default")
GERMANY_ROCK_URL = (
    "https://app.soundcharts.com/app/market/tracks?filters="
    "eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7"
    "ImZjIjoiREUiLCJmdHNnIjoicm9jayIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSw"
    "iZmFyZyI6InJvY2sifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D"
)


with sync_playwright() as playwright:
    # Reuse the user's existing Chrome profile instead of creating an empty
    # isolated context. Close all Chrome windows before running this exporter;
    # do not sign out of Google or Soundcharts.
    context = playwright.chromium.launch_persistent_context(
        user_data_dir=str(CHROME_USER_DATA_DIR),
        channel="chrome",
        headless=False,
        args=[f"--profile-directory={CHROME_PROFILE_DIR}"],
        viewport={"width": 1440, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    page.goto(GERMANY_ROCK_URL, wait_until="domcontentloaded", timeout=60_000)
    input("Confirm the already logged-in Germany Rock page, then press Enter here: ")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    context.storage_state(path=str(OUTPUT))
    context.close()

print(f"Saved browser storage state to {OUTPUT.resolve()}")
print("Copy it to GitHub as the SOUNDCHARTS_STORAGE_STATE_B64 secret; do not commit it.")
