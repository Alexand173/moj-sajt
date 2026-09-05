"""Headless browser bridge for the AI-assisted chart scraper.

The chart scraper intentionally continues to use screenshots and OpenAI Vision
for table reading. This module replaces only the physical Windows desktop
boundary so the same workflow can run on a hosted Linux runner.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

try:
    from playwright.sync_api import (
        Browser,
        BrowserContext,
        Error as PlaywrightError,
        Page,
        TimeoutError as PlaywrightTimeoutError,
        sync_playwright,
    )
except ImportError:  # pragma: no cover - reported by require_playwright
    Browser = Any  # type: ignore[assignment,misc]
    BrowserContext = Any  # type: ignore[assignment,misc]
    Page = Any  # type: ignore[assignment,misc]
    PlaywrightError = Exception  # type: ignore[assignment,misc]
    PlaywrightTimeoutError = Exception  # type: ignore[assignment,misc]
    sync_playwright = None  # type: ignore[assignment]


DEFAULT_VIEWPORT = {"width": 1440, "height": 1000}


class ChartBrowserError(RuntimeError):
    """Raised when the hosted browser cannot open an authenticated chart."""


def require_playwright() -> None:
    if sync_playwright is None:
        raise ChartBrowserError(
            "The hosted chart browser requires the Python Playwright package. "
            "Install scripts/requirements-ai-scraper.txt and Chromium."
        )


def storage_state_path_from_env() -> Path:
    value = os.getenv("AI_SCRAPER_BROWSER_STORAGE_STATE", "").strip()
    if not value:
        raise ChartBrowserError(
            "AI_SCRAPER_BROWSER_STORAGE_STATE is required for hosted chart scraping."
        )

    path = Path(value).expanduser().resolve()
    if not path.is_file():
        raise ChartBrowserError(f"Soundcharts browser storage state was not found: {path}")

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ChartBrowserError(
            f"Soundcharts browser storage state is not valid JSON: {path}"
        ) from error

    if not isinstance(payload, dict):
        raise ChartBrowserError("Soundcharts browser storage state must be a JSON object.")
    return path


class ChartBrowser:
    """Small synchronous Playwright wrapper using viewport-relative coordinates."""

    def __init__(
        self,
        *,
        storage_state_path: str | Path | None = None,
        viewport: dict[str, int] | None = None,
        headless: bool = True,
    ) -> None:
        require_playwright()
        state_path = (
            Path(storage_state_path).expanduser().resolve()
            if storage_state_path
            else storage_state_path_from_env()
        )
        if not state_path.is_file():
            raise ChartBrowserError(f"Soundcharts browser storage state was not found: {state_path}")

        self._playwright = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

        try:
            assert sync_playwright is not None
            self._playwright = sync_playwright().start()
            self._browser = self._playwright.chromium.launch(
                headless=headless,
                args=["--disable-dev-shm-usage"],
            )
            self._context = self._browser.new_context(
                storage_state=str(state_path),
                viewport=viewport or DEFAULT_VIEWPORT,
                device_scale_factor=1,
            )
            self._page = self._context.new_page()
            self._page.set_default_timeout(15_000)
        except Exception as error:
            self.close()
            raise ChartBrowserError(f"Could not start hosted Chromium: {error}") from error

    @property
    def page(self) -> Page:
        if self._page is None:
            raise ChartBrowserError("Hosted chart browser is closed.")
        return self._page

    def open_chart(self, chart_url: str, *, wait_seconds: float = 5.0) -> None:
        try:
            self.page.goto(chart_url, wait_until="domcontentloaded", timeout=60_000)
            if wait_seconds > 0:
                self.page.wait_for_timeout(int(wait_seconds * 1000))
            self._assert_authenticated()
        except ChartBrowserError:
            raise
        except PlaywrightTimeoutError as error:
            raise ChartBrowserError(f"Timed out opening chart URL: {chart_url}") from error
        except PlaywrightError as error:
            raise ChartBrowserError(f"Could not open chart URL: {chart_url}") from error

    def _assert_authenticated(self) -> None:
        url = self.page.url.lower()
        if any(marker in url for marker in ("/login", "/signin", "/sign-in", "auth")):
            raise ChartBrowserError(
                "Soundcharts redirected to authentication. Refresh the storage-state secret."
            )

        try:
            body_text = self.page.locator("body").inner_text(timeout=3_000).lower()
        except PlaywrightError:
            body_text = ""

        login_markers = (
            "log in to soundcharts",
            "sign in to soundcharts",
            "authentication required",
            "session expired",
            "unauthorized",
        )
        if any(marker in body_text for marker in login_markers):
            raise ChartBrowserError(
                "Soundcharts session is unavailable. Refresh the storage-state secret."
            )

    def screenshot(self, path: str | Path) -> tuple[int, int]:
        destination = Path(path).expanduser().resolve()
        destination.parent.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(destination), full_page=False, animations="disabled")
        viewport = self.page.viewport_size or DEFAULT_VIEWPORT
        return int(viewport["width"]), int(viewport["height"])

    def viewport_size(self) -> tuple[int, int]:
        viewport = self.page.viewport_size or DEFAULT_VIEWPORT
        return int(viewport["width"]), int(viewport["height"])

    def click_at(self, x: int, y: int) -> None:
        self._validate_coordinates(x, y)
        self.page.mouse.click(x, y)

    def type_at(self, x: int, y: int, value: str) -> None:
        self._validate_coordinates(x, y)
        self.page.mouse.click(x, y)
        self.page.keyboard.press("Control+A")
        self.page.keyboard.type(value, delay=30)
        self.page.keyboard.press("Enter")

    def press(self, key: str) -> None:
        self.page.keyboard.press(key)

    def wait(self, seconds: float) -> None:
        if seconds > 0:
            self.page.wait_for_timeout(int(seconds * 1000))

    def _validate_coordinates(self, x: int, y: int) -> None:
        width, height = self.viewport_size()
        if x < 0 or y < 0 or x >= width or y >= height:
            raise ChartBrowserError(
                f"Vision returned coordinates outside the browser viewport: ({x}, {y}) "
                f"for {width}x{height}."
            )

    def close(self) -> None:
        for resource in (self._context, self._browser, self._playwright):
            if resource is None:
                continue
            try:
                resource.close() if resource is not self._playwright else resource.stop()
            except Exception:
                pass
        self._page = None
        self._context = None
        self._browser = None
        self._playwright = None

    def __enter__(self) -> "ChartBrowser":
        return self

    def __exit__(self, _exc_type: object, _exc_value: object, _traceback: object) -> None:
        self.close()
