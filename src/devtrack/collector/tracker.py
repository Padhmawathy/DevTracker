import time
from datetime import datetime

from devtrack.collector.idle import get_idle_seconds
from devtrack.storage.sqlite_store import SQLiteActivityStore
from devtrack.collector.foreground import get_active_window
from devtrack.models.activity import Activity
from devtrack.collector.session import is_workstation_locked


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
    def __init__(
        self,
        poll_interval=1,
        idle_threshold=300,
        min_activity_duration=2,
        store=None
    ):
        self.poll_interval = poll_interval
        self.idle_threshold = idle_threshold
        self.min_activity_duration = ( 
            min_activity_duration
        )
   
        self.current_activity = None
        self.last_window = None

        self.is_idle = False
        self.is_locked = False

        self.lock_candidate = False
        self.lock_candidate_count = 0
        self.lock_confirmation_polls = 2

        self.last_poll_time = time.monotonic()
        self.last_poll_datetime = datetime.now()
        self.max_poll_gap = 10

        self.store = store or SQLiteActivityStore()

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

    def enter_locked_state(self):
        if self.current_activity:
            self.finish_activity()

        self.current_activity = None
        self.last_window = None
        self.is_locked = True
        self.is_idle = False

        print("[LOCKED] Windows workstation locked")


    def exit_locked_state(self):
        self.is_locked = False
        self.last_window = None

        print("[UNLOCKED] Windows workstation unlocked")

    def finish_activity(self, ended_at=None):
        if not self.current_activity:
            return

        if ended_at is None:
            ended_at = datetime.now()

        self.current_activity.finish(
            ended_at
        )

        duration = self.current_activity.duration_seconds

        if duration >= self.min_activity_duration:
            print(
                "[ACTIVITY END] "
                f"{self.current_activity.process_name} | "
                f"{self.current_activity.window_title} | "
                f"{format_duration(duration)}"
            )

            self.store.save(
                self.current_activity
            )

        else:
            print(
                "[IGNORED SHORT ACTIVITY] "
                f"{self.current_activity.process_name} | "
                f"{duration:.2f}s"
            )

        self.current_activity = None


    def check_lock_state(self):
        detected_locked = is_workstation_locked()

        if detected_locked == self.lock_candidate:
            self.lock_candidate_count += 1
        else:
            self.lock_candidate = detected_locked
            self.lock_candidate_count = 1

        if self.lock_candidate_count < self.lock_confirmation_polls:
            return

        if detected_locked and not self.is_locked:
            self.enter_locked_state()

        elif not detected_locked and self.is_locked:
            self.exit_locked_state()

    def detect_tracking_gap(self):
        now_time = time.monotonic()
        now_datetime = datetime.now()

        gap = now_time - self.last_poll_time

        if gap > self.max_poll_gap:
            print(
                f"[TRACKING GAP] "
                f"Collector was unavailable for {gap:.1f}s"
            )

            if self.current_activity:
                self.finish_activity(
                    ended_at=self.last_poll_datetime
                )

            self.current_activity = None
            self.last_window = None
            self.is_idle = False

        self.last_poll_time = now_time
        self.last_poll_datetime = now_datetime
        
    def enter_idle_state(self):
        if self.current_activity:
            self.finish_activity()

        self.current_activity = None
        self.last_window = None
        self.is_idle = True

        print("[IDLE] User became inactive")


    def exit_idle_state(self):
        self.is_idle = False

        print("[ACTIVE] User returned")
    def run(self):
        print("DevTrack activity tracker started.")
        print("Press Ctrl+C to stop.\n")

        try:
            self.detect_tracking_gap()
            while True:

                idle_seconds = get_idle_seconds()
                self.detect_tracking_gap()
                self.check_lock_state()
                if self.is_locked:
                    time.sleep(self.poll_interval)
                    continue
                if idle_seconds >= self.idle_threshold:

                    if not self.is_idle:
                        self.enter_idle_state()

                    time.sleep(self.poll_interval)
                    continue

                if self.is_idle:
                    self.exit_idle_state()

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