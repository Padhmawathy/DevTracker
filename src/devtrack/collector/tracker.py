import time
from datetime import datetime

from devtrack.collector.foreground import get_active_window
from devtrack.models.activity import Activity


def format_duration(seconds):
    seconds = int(seconds)

    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    if hours:
        return f"{hours}h {minutes}m {seconds}s"

    if minutes:
        return f"{minutes}m {seconds}s"

    return f"{seconds}s"


class ActivityTracker:
    def __init__(self, poll_interval=1):
        self.poll_interval = poll_interval
        self.current_activity = None
        self.last_window = None

    def start_activity(self, window):
        self.current_activity = Activity(
            process_name=window["process_name"],
            process_id=window["process_id"],
            window_title=window["window_title"],
            started_at=datetime.now(),
        )

        print(
            "[ACTIVITY START] "
            f"{self.current_activity.process_name} | "
            f"{self.current_activity.window_title} | "
            f"{self.current_activity.started_at.strftime('%H:%M:%S')}"
        )

    def finish_activity(self):
        if not self.current_activity:
            return

        self.current_activity.finish(
            datetime.now()
        )

        print(
            "[ACTIVITY END] "
            f"{self.current_activity.process_name} | "
            f"{self.current_activity.window_title} | "
            f"{format_duration(self.current_activity.duration_seconds)}"
        )

        print(
            self.current_activity.to_dict()
        )

    def run(self):
        print("DevTrack activity tracker started.")
        print("Press Ctrl+C to stop.\n")

        try:
            while True:
                window = get_active_window()

                if not window:
                    time.sleep(self.poll_interval)
                    continue

                window_identity = (
                    window["process_name"],
                    window["window_title"],
                )

                if window_identity != self.last_window:

                    if self.current_activity:
                        self.finish_activity()

                    self.start_activity(window)

                    self.last_window = window_identity

                time.sleep(self.poll_interval)

        except KeyboardInterrupt:

            if self.current_activity:
                self.finish_activity()

            print(
                "\nDevTrack activity tracker stopped."
            )