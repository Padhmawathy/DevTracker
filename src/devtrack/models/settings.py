
from dataclasses import dataclass, asdict


@dataclass
class TrackerSettings:
    tracking_enabled: bool = True
    poll_interval: int = 1
    idle_threshold: int = 300
    min_activity_duration: int = 2
    collect_window_titles: bool = True

    def __post_init__(self):
        for name in (
            "tracking_enabled",
            "collect_window_titles",
        ):
            if not isinstance(getattr(self, name), bool):
                raise ValueError(f"{name} must be a boolean")

        limits = {
            "poll_interval": (1, 60),
            "idle_threshold": (30, 3600),
            "min_activity_duration": (1, 60),
        }

        for name, (minimum, maximum) in limits.items():
            value = getattr(self, name)

            if type(value) is not int:
                raise ValueError(f"{name} must be an integer")

            if not minimum <= value <= maximum:
                raise ValueError(
                    f"{name} must be between {minimum} and {maximum}"
                )

    def to_dict(self):
        return asdict(self)
