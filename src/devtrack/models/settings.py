
from dataclasses import dataclass, asdict
from datetime import time


@dataclass
class TrackerSettings:
    # Existing tracking settings
    tracking_enabled: bool = True
    poll_interval: int = 1
    idle_threshold: int = 300
    min_activity_duration: int = 2
    collect_window_titles: bool = True

    # Phase 7: Smart check-in reminders
    reminders_enabled: bool = True
    reminder_interval_minutes: int = 60
    reminder_work_start: str = "09:00"
    reminder_work_end: str = "18:00"
    reminder_snooze_minutes: int = 15
    reminders_respect_idle: bool = True

    def __post_init__(self):
        boolean_fields = (
            "tracking_enabled",
            "collect_window_titles",
            "reminders_enabled",
            "reminders_respect_idle",
        )

        for name in boolean_fields:
            if not isinstance(getattr(self, name), bool):
                raise ValueError(f"{name} must be a boolean")

        limits = {
            "poll_interval": (1, 60),
            "idle_threshold": (30, 3600),
            "min_activity_duration": (1, 60),
            "reminder_interval_minutes": (15, 240),
            "reminder_snooze_minutes": (5, 60),
        }

        for name, (minimum, maximum) in limits.items():
            value = getattr(self, name)

            if type(value) is not int:
                raise ValueError(f"{name} must be an integer")

            if not minimum <= value <= maximum:
                raise ValueError(
                    f"{name} must be between {minimum} and {maximum}"
                )

        for name in ("reminder_work_start", "reminder_work_end"):
            value = getattr(self, name)

            if not isinstance(value, str):
                raise ValueError(f"{name} must be a HH:MM string")

            try:
                parsed = time.fromisoformat(value)
            except ValueError as exc:
                raise ValueError(
                    f"{name} must use HH:MM format"
                ) from exc

            if (
                len(value) != 5
                or value[2] != ":"
                or not (value[:2] + value[3:]).isdigit()
                or parsed.second != 0
            ):
                raise ValueError(
                    f"{name} must use HH:MM format"
                )

        if self.reminder_work_start >= self.reminder_work_end:
            raise ValueError(
                "reminder_work_start must be before reminder_work_end"
            )

    def to_dict(self):
        return asdict(self)
