"""Export a manually authenticated Soundcharts Playwright storage state.

Run locally, complete the login in the visible browser, and press Enter after
the chart page is accessible. Treat the output as a password and never commit
or print it.
"""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT = Path(".tmp/soundcharts-storage-state.json")
GERMANY_ROCK_URL = (
    "https://app.soundcharts.com/app/market/tracks?filters="
    "eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7"
    "ImZjIjoiREUiLCJmdHNnIjoicm9jayIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSw"
    "iZmFyZyI6InJvY2sifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D"
)


with sync_playwright() as playwright:
    # Use the installed Google Chrome profile/browser engine for local login.
    # GitHub Actions still uses its own headless Chromium on ubuntu-latest.
    browser = playwright.chromium.launch(channel="chrome", headless=False)
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    page.goto(GERMANY_ROCK_URL, wait_until="domcontentloaded", timeout=60_000)
    input("Complete Soundcharts login on the Germany Rock page, then press Enter here: ")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    context.storage_state(path=str(OUTPUT))
    browser.close()

print(f"Saved browser storage state to {OUTPUT.resolve()}")
print("Copy it to GitHub as the SOUNDCHARTS_STORAGE_STATE_B64 secret; do not commit it.")
