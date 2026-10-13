
import time
from datetime import datetime

from devtrack.models.settings import TrackerSettings


class ReminderEngine:
    """Calculate when an active-work check-in reminder is due."""

    def __init__(self):
        self.active_seconds = 0.0
        self.last_monotonic = None
        self.last_eligible = False

    @staticmethod
    def within_work_hours(now, settings):
        current = now.strftime("%H:%M")

        return (
            settings.reminder_work_start
            <= current
            < settings.reminder_work_end
        )

    def tick(
        self,
        settings: TrackerSettings,
        active: bool,
        now: datetime | None = None,
        monotonic_now: float | None = None,
    ) -> bool:
        """
        Return True when a reminder becomes due.

        Call once per collector polling cycle.
        """
        if now is None:
            now = datetime.now()

        if monotonic_now is None:
            monotonic_now = time.monotonic()

        eligible = (
            settings.reminders_enabled
            and settings.tracking_enabled
            and active
            and self.within_work_hours(now, settings)
        )

        if self.last_monotonic is None:
            self.last_monotonic = monotonic_now
            self.last_eligible = eligible
            return False

        elapsed = monotonic_now - self.last_monotonic

        self.last_monotonic = monotonic_now

        # Avoid counting sleep, clock anomalies, or long
        # interruptions as active working time.
        max_gap = max(10, settings.poll_interval * 3)

        valid_elapsed = 0 < elapsed <= max_gap

        if eligible and self.last_eligible and valid_elapsed:
            self.active_seconds += elapsed

        self.last_eligible = eligible

        if not eligible:
            return False

        interval_seconds = (
            settings.reminder_interval_minutes * 60
        )

        if self.active_seconds >= interval_seconds:
            self.active_seconds -= interval_seconds
            return True

        return False
