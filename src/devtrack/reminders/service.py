
import time
from datetime import datetime


class CheckInReminderService:
    def __init__(self, interval_minutes=60):
        if interval_minutes <= 0:
            raise ValueError(
                "Reminder interval must be greater than zero."
            )

        self.interval_seconds = interval_minutes * 60

    def show_reminder(self):
        current_time = datetime.now().strftime("%H:%M:%S")

        print("\n" + "=" * 45)
        print("DevTracker — Developer Check-in Reminder")
        print("=" * 45)
        print(f"Time: {current_time}")
        print("Take a moment to record your work.")
        print("Run: python -m devtrack.checkin_cli")
        print("=" * 45 + "\n")

    
    def run(self):
        print("\nDevTracker reminders started.")
        print(
            f"Reminder interval: "
            f"{self.interval_seconds / 60:g} minutes"
        )
        print("Press Ctrl+C to stop.\n")

        try:
            while True:
                time.sleep(self.interval_seconds)
                self.show_reminder()

                print(
                    "To record work: "
                    "python -m devtrack.checkin_cli"
                )
                print(
                    "To postpone the next reminder, "
                    "enter the snooze duration when prompted."
                )

                response = input(
                    "Snooze minutes (Enter for normal interval): "
                ).strip()

                if response:
                    try:
                        snooze_minutes = float(response)

                        if snooze_minutes <= 0:
                            print(
                                "Invalid duration. "
                                "Using normal interval."
                            )
                        else:
                            time.sleep(snooze_minutes * 60)
                            self.show_reminder()

                    except ValueError:
                        print(
                            "Invalid duration. "
                            "Using normal interval."
                        )

        except KeyboardInterrupt:
            print("\nDevTracker reminders stopped.")
