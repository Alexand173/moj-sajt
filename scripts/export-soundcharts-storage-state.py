"""Export a manually authenticated Soundcharts Playwright storage state.

Run locally, complete the login in the visible browser, and press Enter after
the chart page is accessible. Treat the output as a password and never commit
or print it.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import Error as PlaywrightError, sync_playwright


OUTPUT = Path(".tmp/soundcharts-storage-state.json")
CHROME_USER_DATA_DIR = Path(
    os.getenv("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))
) / "Google" / "Chrome" / "User Data"
# Profile 1 is the Chrome profile mapped to okrenisebre@gmail.com.
CHROME_PROFILE_DIR = os.getenv("SOUNDCHARTS_CHROME_PROFILE", "Profile 1")
EXPECTED_CHROME_EMAIL = os.getenv(
    "SOUNDCHARTS_CHROME_EMAIL", "okrenisebre@gmail.com"
).strip().lower()
CHROME_CDP_URL = os.getenv("SOUNDCHARTS_CHROME_CDP_URL", "").strip()
GERMANY_ROCK_URL = (
    "https://app.soundcharts.com/app/market/tracks?filters="
    "eyJzIjoiY3VzdG9tLnNjX3RyZW5kaW5nX3Njb3JlfGRlc2N8bW9udGh8dG90YWwiLCJmIjp7"
    "ImZjIjoiREUiLCJmdHNnIjoicm9jayIsImZyZCI6IkxUXzYiLCJkc3RyOjppbiI6WyJBTEwiXSw"
    "iZmFyZyI6InJvY2sifSwibWkiOltbImF1ZGllbmNlLnNwb3RpZnkudG90YWwiLHsibW0iOiIifV1dfQ%3D%3D"
)


def verify_chrome_profile() -> None:
    local_state_path = CHROME_USER_DATA_DIR / "Local State"
    try:
        local_state = json.loads(local_state_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"Could not read Chrome profile metadata: {local_state_path}") from error

    profile = local_state.get("profile", {}).get("info_cache", {}).get(CHROME_PROFILE_DIR, {})
    actual_email = str(profile.get("user_name") or "").strip().lower()
    if actual_email != EXPECTED_CHROME_EMAIL:
        raise SystemExit(
            f"Chrome profile {CHROME_PROFILE_DIR!r} is mapped to {actual_email or 'no Gmail account'}, "
            f"not {EXPECTED_CHROME_EMAIL}. Set SOUNDCHARTS_CHROME_PROFILE to the correct profile."
        )


if not CHROME_CDP_URL:
    verify_chrome_profile()


with sync_playwright() as playwright:
    persistent_context = False
    if CHROME_CDP_URL:
        # Optional mode: attach to a Chrome process already started with
        # --remote-debugging-port. This keeps every existing tab open.
        try:
            browser = playwright.chromium.connect_over_cdp(CHROME_CDP_URL)
        except PlaywrightError as error:
            raise SystemExit(
                f"Could not attach to Google Chrome at {CHROME_CDP_URL}. "
                "Start Chrome with --remote-debugging-port and try again."
            ) from error
        contexts = browser.contexts
        if not contexts:
            raise SystemExit("Connected to Chrome, but no browser context is available.")
        context = contexts[0]
    else:
        # Default mode: reopen the user's saved Chrome profile after all Chrome
        # windows are closed. Existing Google/Soundcharts cookies are reused;
        # no empty isolated login session is created.
        try:
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(CHROME_USER_DATA_DIR),
                channel="chrome",
                headless=False,
                args=[f"--profile-directory={CHROME_PROFILE_DIR}"],
                viewport={"width": 1440, "height": 1000},
            )
        except PlaywrightError as error:
            raise SystemExit(
                "Could not open the saved Chrome profile. Close all Chrome windows "
                "or set SOUNDCHARTS_CHROME_CDP_URL for an existing debug session."
            ) from error
        persistent_context = True

    pages = context.pages
    page = next((candidate for candidate in pages if "soundcharts.com" in candidate.url), None)
    if page is None:
        page = pages[0] if pages else context.new_page()
    page.goto(GERMANY_ROCK_URL, wait_until="domcontentloaded", timeout=60_000)
    input("Confirm the already logged-in Germany Rock page, then press Enter here: ")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    context.storage_state(path=str(OUTPUT))
    if persistent_context:
        context.close()
    else:
        browser.close()

print(f"Saved browser storage state to {OUTPUT.resolve()}")
print("Copy it to GitHub as the SOUNDCHARTS_STORAGE_STATE_B64 secret; do not commit it.")
