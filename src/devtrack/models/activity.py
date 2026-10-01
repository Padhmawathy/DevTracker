from dataclasses import dataclass
from datetime import datetime


@dataclass
class Activity:
    process_name: str
    process_id: int
    window_title: str
    started_at: datetime
    ended_at: datetime | None = None
    duration_seconds: float | None = None

    def finish(self, ended_at: datetime):
        self.ended_at = ended_at
        self.duration_seconds = (
            self.ended_at - self.started_at
        ).total_seconds()

    def to_dict(self):
        return {
            "process_name": self.process_name,
            "process_id": self.process_id,
            "window_title": self.window_title,
            "started_at": self.started_at.isoformat(),
            "ended_at": (
                self.ended_at.isoformat()
                if self.ended_at
                else None
            ),
            "duration_seconds": self.duration_seconds,
        }