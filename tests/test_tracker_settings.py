
import unittest
from unittest.mock import MagicMock

from devtrack.collector.tracker import ActivityTracker
from devtrack.models.settings import TrackerSettings


class TestTrackerSettingsIntegration(unittest.TestCase):

    def setUp(self):
        self.activity_store = MagicMock()

        self.tracker = ActivityTracker(
            store=self.activity_store
        )

        self.tracker.settings_store = MagicMock()

    def test_tracking_disabled(self):
        self.tracker.settings_store.load.return_value = (
            TrackerSettings(tracking_enabled=False)
        )

        result = self.tracker.apply_settings()

        self.assertFalse(result)
        self.assertIsNone(self.tracker.current_activity)
        self.assertIsNone(self.tracker.last_window)

    def test_pause_finishes_active_session(self):
        self.tracker.settings_store.load.return_value = (
            TrackerSettings(tracking_enabled=False)
        )

        self.tracker.current_activity = MagicMock()
        self.tracker.last_window = ("Code.exe", "DevTracker")

        self.tracker.finish_activity = MagicMock()

        result = self.tracker.apply_settings()

        self.assertFalse(result)
        self.tracker.finish_activity.assert_called_once()
        self.assertIsNone(self.tracker.current_activity)
        self.assertIsNone(self.tracker.last_window)

    def test_resume_tracking(self):
        self.tracker.settings_store.load.side_effect = [
            TrackerSettings(tracking_enabled=False),
            TrackerSettings(tracking_enabled=True),
        ]

        paused = self.tracker.apply_settings()
        resumed = self.tracker.apply_settings()

        self.assertFalse(paused)
        self.assertTrue(resumed)

        self.assertEqual(self.tracker.poll_interval, 1)
        self.assertEqual(self.tracker.idle_threshold, 300)

    
    def test_window_titles_disabled(self):
        self.tracker.settings_store.load.return_value = (
            TrackerSettings(collect_window_titles=False)
        )

        self.tracker.apply_settings()

        window = {
            "process_name": "Code.exe",
            "process_id": 1234,
            "window_title": "PrivateProject.py",
        }

        self.tracker.start_activity(window)

        self.assertEqual(
            self.tracker.current_activity.window_title,
            "",
        )

        self.assertEqual(
            self.tracker.current_activity.process_name,
            "Code.exe",
        )

    def test_window_titles_enabled(self):
        self.tracker.settings_store.load.return_value = (
            TrackerSettings(collect_window_titles=True)
        )

        self.tracker.apply_settings()

        window = {
            "process_name": "Code.exe",
            "process_id": 1234,
            "window_title": "DevTracker.py",
        }

        self.tracker.start_activity(window)

        self.assertEqual(
            self.tracker.current_activity.window_title,
            "DevTracker.py",
        )

    
    def test_disabling_titles_finishes_active_session(self):
        self.tracker.current_activity = MagicMock()
        self.tracker.last_window = ("Code.exe", "Private.py")
        self.tracker.collect_window_titles = True
        self.tracker.finish_activity = MagicMock()

        self.tracker.settings_store.load.return_value = (
            TrackerSettings(collect_window_titles=False)
        )

        result = self.tracker.apply_settings()

        self.assertTrue(result)
        self.tracker.finish_activity.assert_called_once()
        self.assertIsNone(self.tracker.last_window)
        self.assertFalse(self.tracker.collect_window_titles)

    def test_enabling_titles_finishes_active_session(self):
        self.tracker.current_activity = MagicMock()
        self.tracker.last_window = ("Code.exe", "")
        self.tracker.collect_window_titles = False
        self.tracker.finish_activity = MagicMock()

        self.tracker.settings_store.load.return_value = (
            TrackerSettings(collect_window_titles=True)
        )

        result = self.tracker.apply_settings()

        self.assertTrue(result)
        self.tracker.finish_activity.assert_called_once()
        self.assertIsNone(self.tracker.last_window)
        self.assertTrue(self.tracker.collect_window_titles)

    
    def test_poll_gap_adjusts_to_settings(self):
        self.tracker.settings_store.load.return_value = (
            TrackerSettings(poll_interval=12)
        )

        self.tracker.apply_settings()

        self.assertEqual(self.tracker.poll_interval, 12)
        self.assertEqual(self.tracker.max_poll_gap, 36)

    def test_poll_gap_default(self):
        self.tracker.settings_store.load.return_value = (
            TrackerSettings(poll_interval=1)
        )

        self.tracker.apply_settings()

        self.assertEqual(self.tracker.max_poll_gap, 10)

if __name__ == "__main__":
    unittest.main()