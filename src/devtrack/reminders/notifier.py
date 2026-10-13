
from winotify import Notification, audio


class WindowsNotifier:
    """Display native Windows notifications for DevTracker."""

    def send_checkin_reminder(self) -> bool:
        try:
            toast = Notification(
                app_id="DevTracker",
                title="DevTracker — Check-in Reminder",
                msg=(
                    "You've reached your active-work interval. "
                    "Take a moment to record your progress."
                ),
                duration="short",
            )

            toast.set_audio(
                audio.Default,
                loop=False,
            )

            toast.show()
            return True

        except Exception as exc:
            print(f"[NOTIFICATION ERROR] {exc}")
            return False
