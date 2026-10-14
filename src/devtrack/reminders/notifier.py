
import re
import time

from winotify import Notification, audio


class WindowsNotifier:
    """Display Windows check-in reminders."""

    def send_checkin_reminder(
        self,
        reminder_id: str | None = None,
    ) -> bool:
        try:
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
                launch="http://127.0.0.1:8000/?page=checkins",
            )

            # Enable state-changing buttons only when the
            # notification belongs to a specific reminder.
            if reminder_id is not None:
                toast.add_actions(
                    label="Snooze",
                    launch=(
                        "devtracker-reminder://snooze/"
                        f"{reminder_id}"
                    ),
                )

                toast.add_actions(
                    label="Skip",
                    launch=(
                        "devtracker-reminder://skip/"
                        f"{reminder_id}"
                    ),
                )

            toast.show()

            return True

        except Exception as exc:
            print(f"[NOTIFICATION ERROR] {exc}")
            return False
