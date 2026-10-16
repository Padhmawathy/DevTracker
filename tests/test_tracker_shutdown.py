
import threading
import unittest
from unittest.mock import MagicMock, patch

from devtrack.collector.tracker import ActivityTracker


class TestTrackerShutdown(unittest.TestCase):

    def test_stop_sets_shutdown_event(self):
        with patch(
            "devtrack.collector.tracker.SQLiteActivityStore"
        ):
            tracker = ActivityTracker()

        self.assertFalse(tracker.stop_event.is_set())

        tracker.stop()

        self.assertTrue(tracker.stop_event.is_set())

    def test_tracker_exits_when_stop_requested(self):
        with patch(
            "devtrack.collector.tracker.SQLiteActivityStore"
        ):
            tracker = ActivityTracker()

        tracker.stop()

        worker = threading.Thread(target=tracker.run)
        worker.start()
        worker.join(timeout=3)

        self.assertFalse(worker.is_alive())

    def test_active_activity_is_saved_on_shutdown(self):
        store = MagicMock()

        with patch(
            "devtrack.collector.tracker.JSONReminderStateStore"
        ):
            tracker = ActivityTracker(
                store=store,
                min_activity_duration=0,
            )

        activity = MagicMock()
        activity.started_at = __import__(
            "datetime"
        ).datetime.now()
        activity.duration_seconds = 10
        activity.process_name = "Code.exe"
        activity.window_title = "Editor"

        tracker.current_activity = activity
        tracker.stop()

        tracker.run()

        store.save.assert_called_once_with(activity)


if __name__ == "__main__":
    unittest.main()
