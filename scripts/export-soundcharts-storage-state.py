"""Export a manually authenticated Soundcharts Playwright storage state.

Run locally, complete the login in the visible browser, and press Enter after
the chart page is accessible. Treat the output as a password and never commit
or print it.
"""

from __future__ import annotations

from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT = Path(".tmp/soundcharts-storage-state.json")
CHART_URL = "https://app.soundcharts.com/app/market/tracks"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=False)
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    page = context.new_page()
    page.goto(CHART_URL, wait_until="domcontentloaded", timeout=60_000)
    input("Complete Soundcharts login in the browser, then press Enter here: ")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    context.storage_state(path=str(OUTPUT))
    browser.close()

print(f"Saved browser storage state to {OUTPUT.resolve()}")
print("Copy it to GitHub as the SOUNDCHARTS_STORAGE_STATE_B64 secret; do not commit it.")
