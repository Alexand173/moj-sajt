from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from chart_browser import ChartBrowser, ChartBrowserError, storage_state_path_from_env


class _FakePage:
    viewport_size = {"width": 1440, "height": 1000}


class ChartBrowserTests(unittest.TestCase):
    def test_storage_state_requires_a_json_object(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "state.json"
            path.write_text(json.dumps(["not-an-object"]), encoding="utf-8")
            with patch.dict(os.environ, {"AI_SCRAPER_BROWSER_STORAGE_STATE": str(path)}):
                with self.assertRaisesRegex(ChartBrowserError, "must be a JSON object"):
                    storage_state_path_from_env()

    def test_storage_state_returns_existing_json_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "state.json"
            path.write_text(json.dumps({"cookies": [], "origins": []}), encoding="utf-8")
            with patch.dict(os.environ, {"AI_SCRAPER_BROWSER_STORAGE_STATE": str(path)}):
                self.assertEqual(storage_state_path_from_env(), path.resolve())

    def test_coordinates_are_viewport_relative(self) -> None:
        browser = ChartBrowser.__new__(ChartBrowser)
        browser._page = _FakePage()
        with self.assertRaisesRegex(ChartBrowserError, "outside the browser viewport"):
            browser._validate_coordinates(1440, 999)
        browser._validate_coordinates(1439, 999)


if __name__ == "__main__":
    unittest.main()
