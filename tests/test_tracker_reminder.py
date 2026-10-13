
import unittest
from unittest.mock import MagicMock

from devtrack.collector.tracker import ActivityTracker
from devtrack.models.settings import TrackerSettings


class TestTrackerReminderIntegration(unittest.TestCase):

    def setUp(self):
        self.tracker = ActivityTracker(
            store=MagicMock()
        )

        self.tracker.current_settings = TrackerSettings(
            reminders_enabled=True,
            reminder_interval_minutes=15,
        )

        self.tracker.reminder_engine = MagicMock()

    def test_active_work_updates_reminder_engine(self):
        self.tracker.reminder_engine.tick.return_value = False

        self.tracker.check_reminder(active=True)

        self.tracker.reminder_engine.tick.assert_called_once_with(
            settings=self.tracker.current_settings,
            active=True,
        )

    def test_idle_state_updates_reminder_engine(self):
        self.tracker.reminder_engine.tick.return_value = False

        self.tracker.check_reminder(active=False)

        self.tracker.reminder_engine.tick.assert_called_once_with(
            settings=self.tracker.current_settings,
            active=False,
        )

    def test_no_reminder_without_settings(self):
        self.tracker.current_settings = None

        self.tracker.check_reminder(active=True)

        self.tracker.reminder_engine.tick.assert_not_called()


if __name__ == "__main__":
    unittest.main()
