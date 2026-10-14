
import unittest
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch

from devtrack.collector.tracker import ActivityTracker
from devtrack.models.settings import TrackerSettings
from devtrack.reminders.state_store import JSONReminderStateStore


class TestReminderRestart(unittest.TestCase):

    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)

        self.state_path = (
            Path(self.folder.name) / "reminder_state.json"
        )

        self.settings = TrackerSettings(
            reminder_snooze_minutes=15,
        )

    def create_tracker(self):
        tracker = ActivityTracker(
            store=MagicMock(),
            reminder_state_store=JSONReminderStateStore(
                self.state_path
            ),
        )
        tracker.current_settings = self.settings
        return tracker

    def test_snooze_survives_collector_restart(self):
        first_tracker = self.create_tracker()
        first_tracker.reminder_state.mark_due()

        with patch(
            "devtrack.collector.tracker.datetime"
        ) as mock_datetime:
            mock_datetime.now.return_value = datetime(
                2026, 10, 13, 10, 0
            )
            self.assertTrue(
                first_tracker.snooze_reminder()
            )

        # Simulate restart by constructing a new collector.
        restarted_tracker = self.create_tracker()

        self.assertTrue(
            restarted_tracker.reminder_state.pending
        )
        self.assertEqual(
            restarted_tracker.reminder_state.snoozed_until,
            datetime(2026, 10, 13, 10, 15),
        )

    def test_skip_persists_after_restart(self):
        first_tracker = self.create_tracker()
        first_tracker.reminder_state.mark_due()

        with patch(
            "devtrack.collector.tracker.datetime"
        ) as mock_datetime:
            mock_datetime.now.return_value = datetime(
                2026, 10, 13, 10, 0
            )
            self.assertTrue(
                first_tracker.snooze_reminder()
            )

        self.assertTrue(first_tracker.skip_reminder())

        restarted_tracker = self.create_tracker()

        self.assertFalse(
            restarted_tracker.reminder_state.pending
        )
        self.assertIsNone(
            restarted_tracker.reminder_state.snoozed_until
        )


if __name__ == "__main__":
    unittest.main()
