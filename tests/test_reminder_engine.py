
import unittest
from datetime import datetime, timedelta

from devtrack.models.settings import TrackerSettings
from devtrack.reminders.engine import ReminderEngine


class TestReminderEngine(unittest.TestCase):

    def setUp(self):
        self.engine = ReminderEngine()
        self.settings = TrackerSettings(
            reminder_interval_minutes=15,
            reminder_work_start="09:00",
            reminder_work_end="18:00",
        )
        self.start = datetime(2026, 10, 12, 10, 0)

    def simulate(self, minutes, active=True):
        """Simulate polling once per second."""
        fired = 0

        for second in range(minutes * 60 + 1):
            current = self.start + timedelta(seconds=second)

            if self.engine.tick(
                settings=self.settings,
                active=active,
                now=current,
                monotonic_now=float(second),
            ):
                fired += 1

        return fired

    def test_reminder_after_active_interval(self):
        self.assertEqual(self.simulate(15), 1)

    def test_no_early_reminder(self):
        self.assertEqual(self.simulate(14), 0)

    def test_disabled_reminders(self):
        self.settings.reminders_enabled = False
        self.assertEqual(self.simulate(30), 0)

    def test_outside_working_hours(self):
        self.start = datetime(2026, 10, 12, 20, 0)
        self.assertEqual(self.simulate(30), 0)

    def test_idle_does_not_count(self):
        self.engine.tick(
            self.settings,
            active=True,
            now=self.start,
            monotonic_now=0,
        )

        for second in range(1, 901):
            now = self.start + timedelta(seconds=second)
            self.engine.tick(
                self.settings,
                active=False,
                now=now,
                monotonic_now=float(second),
            )

        self.assertEqual(self.engine.active_seconds, 0)

    def test_long_gap_does_not_count(self):
        self.engine.tick(
            self.settings,
            active=True,
            now=self.start,
            monotonic_now=0,
        )

        due = self.engine.tick(
            self.settings,
            active=True,
            now=self.start + timedelta(minutes=30),
            monotonic_now=1800,
        )

        self.assertFalse(due)
        self.assertEqual(self.engine.active_seconds, 0)

    def test_only_one_reminder_per_interval(self):
        self.assertEqual(self.simulate(30), 2)


if __name__ == "__main__":
    unittest.main()
