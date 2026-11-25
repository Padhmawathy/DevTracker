
import re
import subprocess
import sys
import time


class WindowsNotifier:
    """Display Windows check-in reminders."""

    def send_checkin_reminder(
        self,
        reminder_id: str | None = None,
    ) -> bool:
        try:
            from winotify import Notification, audio

            if reminder_id is not None:
                if (
                    not isinstance(reminder_id, str)
                    or re.fullmatch(
                        r"[0-9a-f]{32}",
                        reminder_id,
                    ) is None
                ):
                    raise ValueError("Invalid reminder ID")

            notification_id = int(time.time() * 1000)

            toast = Notification(
                app_id="DevTracker",
                title=(
                    "DevTracker — Check-in Reminder "
                    f"#{notification_id}"
                ),
                msg=(
                    "You've reached your active-work interval. "
                    "Take a moment to record your progress."
                ),
                duration="long",
            )

            toast.set_audio(
                audio.Default,
                loop=False,
            )

            # Always allow the user to open the journal.
            toast.add_actions(
                label="Open Check-ins",
                launch="devtrack://open/checkins",
            )

            # Enable state-changing buttons only when the
            # notification belongs to a specific reminder.
            if reminder_id is not None:
                toast.add_actions(
                    label="Snooze",
                    launch=(
                        "devtrack://snooze/"
                        f"{reminder_id}"
                    ),
                )

                toast.add_actions(
                    label="Skip",
                    launch=(
                        "devtrack://skip/"
                        f"{reminder_id}"
                    ),
                )

            toast.show()

            return True

        except Exception as exc:
            print(f"[NOTIFICATION ERROR] {exc}")
            return False


class MacNotifier:
    """Display macOS check-in reminders through Notification Center.

    AppleScript notifications cannot carry buttons, so Snooze and Skip
    stay in the app; the reminder tells the user where to find them.
    """

    def send_checkin_reminder(
        self,
        reminder_id: str | None = None,
    ) -> bool:
        script = (
            'display notification '
            '"You have reached your active-work interval. '
            'Open DevTrack to record your progress." '
            'with title "DevTrack" '
            'subtitle "Check-in reminder" '
            'sound name "default"'
        )

        try:
            subprocess.run(
                ["/usr/bin/osascript", "-e", script],
                check=True,
                capture_output=True,
                timeout=10,
            )
            return True

        except (OSError, subprocess.SubprocessError) as exc:
            print(f"[NOTIFICATION ERROR] {exc}")
            return False


def create_notifier():
    """Return the reminder notifier for the current operating system."""
    if sys.platform == "darwin":
        return MacNotifier()

    return WindowsNotifier()
