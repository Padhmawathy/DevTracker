
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from devtrack.models.settings import TrackerSettings
from devtrack.storage.settings_store import JSONSettingsStore


class TestSettingsPortablePaths(unittest.TestCase):

    def test_default_path_uses_path_helper(self):
        expected = Path("example") / "settings.json"

        with patch(
            "devtrack.storage.settings_store.get_data_path",
            return_value=expected,
        ):
            store = JSONSettingsStore()

        self.assertEqual(store.path, expected)

    def test_explicit_path_is_preserved(self):
        custom_path = Path("custom") / "settings.json"

        store = JSONSettingsStore(custom_path)

        self.assertEqual(store.path, custom_path)

    def test_save_and_load_with_portable_path(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "settings.json"

            with patch(
                "devtrack.storage.settings_store.get_data_path",
                return_value=path,
            ):
                store = JSONSettingsStore()

                settings = TrackerSettings(
                    reminder_interval_minutes=15,
                )

                store.save(settings)
                restored = store.load()

            self.assertEqual(
                restored.reminder_interval_minutes,
                15,
            )
            self.assertTrue(path.exists())


if __name__ == "__main__":
    unittest.main()
