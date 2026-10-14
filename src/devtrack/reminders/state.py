
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import uuid4


@dataclass
class ReminderState:
    """Track the current reminder and its snooze status."""

    pending: bool = False
    snoozed_until: datetime | None = None
    reminder_id: str | None = None

    def mark_due(self) -> bool:
        """Register a new reminder with a unique identifier."""
        if self.pending:
            return False

        self.pending = True
        self.snoozed_until = None
        self.reminder_id = uuid4().hex

        return True

    def snooze(self, minutes: int, now: datetime) -> None:
        """Postpone the current reminder."""
        if not self.pending:
            raise ValueError("No pending reminder to snooze")

        if type(minutes) is not int or minutes < 1:
            raise ValueError("Snooze duration must be positive")

        self.snoozed_until = now + timedelta(
            minutes=minutes
        )

    def is_snooze_due(self, now: datetime) -> bool:
        return (
            self.pending
            and self.snoozed_until is not None
            and now >= self.snoozed_until
        )

    def acknowledge_snooze(self) -> None:
        """Mark a snoozed reminder as delivered."""
        self.snoozed_until = None

    def skip(self) -> None:
        """Dismiss the current reminder."""
        self.pending = False
        self.snoozed_until = None
        self.reminder_id = None

    def complete_checkin(self) -> None:
        """Clear the reminder after a completed check-in."""
        self.skip()
