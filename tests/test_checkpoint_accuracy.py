import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock
from devtrack.collector.tracker import ActivityTracker
from devtrack.models.activity import Activity
class TestCheckpointAccuracy(unittest.TestCase):
    def setUp(self):
        self.store = MagicMock()
        self.tracker = ActivityTracker(store=self.store)
        self.start = datetime(2026, 10, 27, 10, 0, 0)
    def make_activity(self, started_at=None):
        return Activity(
            process_name="brave.exe",
            process_id=123,
            window_title="Browser",
            started_at=started_at or self.start,
        )
    def saved_durations(self):
        return [
            call.args[0].duration_seconds
            for call in self.store.save.call_args_list
        ]
    def test_repeated_checkpoints_preserve_all_seconds(self):
        self.tracker.current_activity = self.make_activity()
        self.tracker.checkpoint_activity(
            now=self.start + timedelta(seconds=30)
        )
        self.tracker.checkpoint_activity(
            now=self.start + timedelta(seconds=60)
        )
        self.tracker.finish_activity(
            ended_at=self.start + timedelta(seconds=61)
        )
        self.assertEqual(self.saved_durations(), [30, 30, 1])
        self.assertEqual(sum(self.saved_durations()), 61)
    def test_new_short_activity_is_ignored(self):
        self.tracker.current_activity = self.make_activity()
        self.tracker.finish_activity(
            ended_at=self.start + timedelta(seconds=1)
        )
        self.store.save.assert_not_called()
    def test_checkpoint_state_resets_for_next_activity(self):
        self.tracker.current_activity = self.make_activity()
        self.tracker.checkpoint_activity(
            now=self.start + timedelta(seconds=30)
        )
        self.tracker.finish_activity(
            ended_at=self.start + timedelta(seconds=31)
        )
        self.assertFalse(self.tracker.activity_has_checkpoint)
        self.store.reset_mock()
        self.tracker.current_activity = self.make_activity(
            started_at=self.start + timedelta(seconds=40)
        )
        self.tracker.finish_activity(
            ended_at=self.start + timedelta(seconds=41)
        )
        self.store.save.assert_not_called()
if __name__ == "__main__":
    unittest.main()
