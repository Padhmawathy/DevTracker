import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock

from devtrack.collector.tracker import ActivityTracker


class TestActivityCheckpoints(unittest.TestCase):
    def test_checkpoint_saves_without_double_counting(self):
        store = MagicMock()
        tracker = ActivityTracker(store=store)
        start = datetime(2026, 10, 27, 10, 0, 0)
        tracker.current_activity = __import__("devtrack.models.activity", fromlist=["Activity"]).Activity(
            process_name="brave.exe",
            process_id=123,
            window_title="Browser",
            started_at=start,
        )

        tracker.checkpoint_activity(now=start + timedelta(seconds=30))

        self.assertEqual(store.save.call_count, 1)
        first = store.save.call_args.args[0]
        self.assertEqual(first.duration_seconds, 30)
        self.assertEqual(tracker.current_activity.started_at, start + timedelta(seconds=30))

        tracker.finish_activity(ended_at=start + timedelta(seconds=45))
        self.assertEqual(store.save.call_count, 2)
        self.assertEqual(store.save.call_args.args[0].duration_seconds, 15)
