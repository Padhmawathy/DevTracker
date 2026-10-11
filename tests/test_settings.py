
import unittest
import tempfile
from pathlib import Path

from devtrack.models.settings import TrackerSettings
from devtrack.storage.settings_store import JSONSettingsStore


class TestTrackerSettings(unittest.TestCase):

    def test_default_settings(self):
        settings = TrackerSettings()

        self.assertTrue(settings.tracking_enabled)
        self.assertEqual(settings.poll_interval, 1)
        self.assertEqual(settings.idle_threshold, 300)
        self.assertEqual(settings.min_activity_duration, 2)
        self.assertTrue(settings.collect_window_titles)

    def test_settings_to_dict(self):
        settings = TrackerSettings(
            tracking_enabled=False,
            idle_threshold=600,
        )

        data = settings.to_dict()

        self.assertFalse(data["tracking_enabled"])
        self.assertEqual(data["idle_threshold"], 600)

    def test_load_default_settings(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "settings.json"

            store = JSONSettingsStore(path)
            settings = store.load()

            self.assertEqual(settings.poll_interval, 1)
            self.assertTrue(settings.tracking_enabled)
            self.assertFalse(path.exists())

    def test_save_and_load_settings(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "settings.json"

            store = JSONSettingsStore(path)

            original = TrackerSettings(
                tracking_enabled=False,
                poll_interval=2,
                idle_threshold=600,
                min_activity_duration=5,
                collect_window_titles=False,
            )

            store.save(original)
            loaded = store.load()

            self.assertEqual(loaded, original)
            self.assertTrue(path.exists())

    
    def test_reject_zero_poll_interval(self):
        with self.assertRaises(ValueError):
            TrackerSettings(poll_interval=0)

    def test_reject_negative_idle_threshold(self):
        with self.assertRaises(ValueError):
            TrackerSettings(idle_threshold=-1)

    def test_reject_invalid_boolean(self):
        with self.assertRaises(ValueError):
            TrackerSettings(tracking_enabled="false")

    def test_reject_non_integer_duration(self):
        with self.assertRaises(ValueError):
            TrackerSettings(min_activity_duration=2.5)

    def test_accept_valid_custom_settings(self):
        settings = TrackerSettings(
            tracking_enabled=False,
            poll_interval=2,
            idle_threshold=600,
            min_activity_duration=5,
            collect_window_titles=False,
        )

        self.assertEqual(settings.poll_interval, 2)
        self.assertFalse(settings.collect_window_titles)


if __name__ == "__main__":
    unittest.main()
