
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from devtrack.models.app_category import AppCategoryRule
from devtrack.storage.app_category_store import JSONAppCategoryStore


class TestAppCategoryPortablePaths(unittest.TestCase):

    def test_default_path_uses_path_helper(self):
        expected = Path("example") / "app_categories.json"

        with patch(
            "devtrack.storage.app_category_store.get_data_path",
            return_value=expected,
        ):
            store = JSONAppCategoryStore()

        self.assertEqual(store.path, expected)

    def test_explicit_path_is_preserved(self):
        custom_path = Path("custom") / "categories.json"

        store = JSONAppCategoryStore(custom_path)

        self.assertEqual(store.path, custom_path)

    def test_save_and_load_with_portable_path(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "app_categories.json"

            with patch(
                "devtrack.storage.app_category_store.get_data_path",
                return_value=path,
            ):
                store = JSONAppCategoryStore()

                rules = [
                    AppCategoryRule(
                        app_name="Code.exe",
                        category="development",
                    ),
                    AppCategoryRule(
                        app_name="chrome.exe",
                        category="research",
                    ),
                ]

                store.save(rules)
                restored = store.load()

            self.assertEqual(restored, rules)
            self.assertTrue(path.exists())

            with path.open("r", encoding="utf-8") as file:
                saved_data = json.load(file)

            self.assertEqual(len(saved_data), 2)
            self.assertEqual(
                saved_data[0]["app_name"],
                "Code.exe",
            )


if __name__ == "__main__":
    unittest.main()
