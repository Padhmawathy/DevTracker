import time
from datetime import datetime

from devtrack.collector.idle import get_idle_seconds
from devtrack.storage.sqlite_store import SQLiteActivityStore
from devtrack.collector.foreground import get_active_window
from devtrack.models.activity import Activity
from devtrack.collector.session import is_workstation_locked
from devtrack.storage.settings_store import JSONSettingsStore
from devtrack.reminders.engine import ReminderEngine
from devtrack.reminders.notifier import WindowsNotifier
from devtrack.reminders.state import ReminderState
from devtrack.reminders.state_store import JSONReminderStateStore
from devtrack.reminders.action_queue import ReminderActionQueue

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
        store=None,
        reminder_state_store=None,
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

        self.pending_lock_state = None
        self.pending_lock_since = None
        self.lock_confirmation_seconds = 3

        self.last_poll_time = time.monotonic()
        self.last_poll_datetime = datetime.now()
        self.max_poll_gap = max(10, self.poll_interval * 3)

        self.store = store or SQLiteActivityStore()
        self.settings_store = JSONSettingsStore()
        self.collect_window_titles = True

        self.reminder_engine = ReminderEngine()
        self.notifier = WindowsNotifier()
        self.current_settings = None

        self.reminder_action_queue = None

        self.reminder_state_store = (
            reminder_state_store
            if reminder_state_store is not None
            else JSONReminderStateStore()
        )
        try:
            self.reminder_state = self.reminder_state_store.load()
        except (OSError, ValueError, TypeError) as exc:
            print(f"[REMINDER STATE] Unable to load saved state: {exc}")
            self.reminder_state = ReminderState()



    
    def start_activity(self, window):
        window_title = (
            window["window_title"]
            if self.collect_window_titles
            else ""
        )

        self.current_activity = Activity(
            process_name=window["process_name"],
            process_id=window["process_id"],
            window_title=window_title,
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
            self.finish_activity(
                ended_at=datetime.now()
            )

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

        if ended_at < self.current_activity.started_at:
            ended_at = self.current_activity.started_at

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
        now = time.monotonic()

        # Raw state matches our confirmed state.
        if detected_locked == self.is_locked:
            self.pending_lock_state = None
            self.pending_lock_since = None
            return

        # A new possible state transition appeared.
        if self.pending_lock_state != detected_locked:
            self.pending_lock_state = detected_locked
            self.pending_lock_since = now
            return

        # Require the new state to remain stable.
        if (
            self.pending_lock_since is not None
            and now - self.pending_lock_since
            >= self.lock_confirmation_seconds
        ):
            if detected_locked:
                self.enter_locked_state()
            else:
                self.exit_locked_state()

            self.pending_lock_state = None
            self.pending_lock_since = None

    def detect_tracking_gap(self):
        now_monotonic = time.monotonic()
        now_datetime = datetime.now()

        monotonic_gap = (
            now_monotonic - self.last_poll_time
        )

        wall_clock_gap = (
            now_datetime - self.last_poll_datetime
        ).total_seconds()

        gap = max(
            monotonic_gap,
            wall_clock_gap,
        )

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

        self.last_poll_time = now_monotonic
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


    
    
    def apply_settings(self):
        settings = self.settings_store.load()
        self.current_settings = settings

        # Close an active session before changing title privacy.
        if (
            self.current_activity is not None
            and self.collect_window_titles
            != settings.collect_window_titles
        ):
            self.finish_activity()
            self.last_window = None

        self.poll_interval = settings.poll_interval
        self.max_poll_gap = max(10, self.poll_interval * 3)
        self.idle_threshold = settings.idle_threshold
        self.min_activity_duration = settings.min_activity_duration
        self.collect_window_titles = settings.collect_window_titles

        if not settings.tracking_enabled:
            if self.current_activity:
                self.finish_activity()

            self.current_activity = None
            self.last_window = None

            return False

        return True

    

   

    def snooze_reminder(self):
        """Postpone the current pending reminder."""
        if self.current_settings is None:
            return False

        if not self.reminder_state.pending:
            return False

        self.reminder_state.snooze(
            minutes=self.current_settings.reminder_snooze_minutes,
            now=datetime.now(),
        )
        self.reminder_state_store.save(self.reminder_state)
        print("[REMINDER] Snoozed")
        return True

    def skip_reminder(self):
        """Dismiss the pending reminder and restart work timing."""
        if not self.reminder_state.pending:
            return False

        self.reminder_state.skip()
        self.reminder_state_store.save(self.reminder_state)
        # Begin a fresh active-work interval.
        self.reminder_engine.active_seconds = 0.0
        self.reminder_engine.last_monotonic = None
        self.reminder_engine.last_eligible = False

        print("[REMINDER] Skipped")
        return True

    def check_reminder(self, active: bool):
        """Handle new reminders and previously snoozed reminders."""
        if self.current_settings is None:
            return

        settings = self.current_settings

        if self.reminder_state.pending:
            # Keep the engine clock updated, but do not
            # accumulate new work while a reminder is pending.
            self.reminder_engine.tick(
                settings=settings,
                active=False,
            )

            # Snoozed reminders only reappear during eligible
            # work periods, not while idle or outside work hours.
            eligible = (
                active
                and settings.tracking_enabled
                and settings.reminders_enabled
                and self.reminder_engine.within_work_hours(
                    datetime.now(),
                    settings,
                )
            )

            if (
                eligible
                and self.reminder_state.is_snooze_due(datetime.now())
            ):
                sent = self.notifier.send_checkin_reminder(
                    self.reminder_state.reminder_id
                )

                if sent:
                    self.reminder_state.acknowledge_snooze()
                    self.reminder_state_store.save(self.reminder_state)
                    print("[REMINDER] Snoozed reminder delivered")
                else:
                    print("[REMINDER] Snoozed notification failed")

            return

        due = self.reminder_engine.tick(
            settings=settings,
            active=active,
        )

        if not due:
            return

        if not self.reminder_state.mark_due():
            return

        
        sent = self.notifier.send_checkin_reminder(
            self.reminder_state.reminder_id
        )

        if sent:
            print("[CHECK-IN REMINDER] Notification sent")
        else:
            # Don't leave an undelivered reminder
            # permanently stuck in the pending state.
            self.reminder_state.skip()
            self.reminder_state_store.save(self.reminder_state)

            # Reset the timing state so a failed delivery
            # cannot cause an immediate notification loop.
            self.reminder_engine.active_seconds = 0.0
            self.reminder_engine.last_monotonic = None
            self.reminder_engine.last_eligible = False

            print("[CHECK-IN REMINDER] Notification failed")


    
    
    def process_reminder_actions(self):
        """Process actions belonging to the current pending reminder."""
        if self.reminder_action_queue is None:
            return

        reminder_id = self.reminder_state.reminder_id

        # No active reminder means no valid notification action.
        if not self.reminder_state.pending or reminder_id is None:
            return

        action = self.reminder_action_queue.consume_for_reminder(
            reminder_id
        )

        if action is None:
            return

        if action == "snooze":
            if self.snooze_reminder():
                print("[REMINDER ACTION] Snooze processed")
            else:
                print("[REMINDER ACTION] Snooze ignored")

        elif action == "skip":
            if self.skip_reminder():
                print("[REMINDER ACTION] Skip processed")
            else:
                print("[REMINDER ACTION] Skip ignored")

    
    def run(self):
        print("DevTrack activity tracker started.")
        print("Press Ctrl+C to stop.\n")

        try:
            self.reminder_action_queue = ReminderActionQueue()
            self.detect_tracking_gap()

            while True:
                if not self.apply_settings():
                    self.check_reminder(active=False)
                    time.sleep(self.poll_interval)
                    continue

                idle_seconds = get_idle_seconds()

                self.detect_tracking_gap()
                self.check_lock_state()

                if self.is_locked:
                    self.check_reminder(active=False)
                    time.sleep(self.poll_interval)
                    continue

                if idle_seconds >= self.idle_threshold:
                    if not self.is_idle:
                        self.enter_idle_state()

                    self.check_reminder(active=False)
                    time.sleep(self.poll_interval)
                    continue

                if self.is_idle:
                    self.exit_idle_state()

                window = get_active_window()

                if not window:
                    self.check_reminder(active=False)
                    time.sleep(self.poll_interval)
                    continue

                window_identity = (
                    window["process_name"],
                    window["window_title"]
                    if self.collect_window_titles
                    else "",
                )

                if window_identity != self.last_window:
                    if self.current_activity:
                        self.finish_activity()

                    self.start_activity(window)
                    self.last_window = window_identity

                # Count eligible working time on each polling cycle.
                self.check_reminder(active=True)

                time.sleep(self.poll_interval)

        except KeyboardInterrupt:
            if self.current_activity:
                self.finish_activity()

            print("\nDevTrack activity tracker stopped.")
