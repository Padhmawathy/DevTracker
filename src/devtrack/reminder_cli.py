
import argparse

from devtrack.reminders.service import CheckInReminderService


def main():
    parser = argparse.ArgumentParser(
        description="DevTracker developer check-in reminders"
    )

    parser.add_argument(
        "--interval",
        type=float,
        default=60,
        help="Reminder interval in minutes (default: 60)",
    )

    args = parser.parse_args()

    if args.interval <= 0:
        parser.error("--interval must be greater than zero")

    service = CheckInReminderService(
        interval_minutes=args.interval
    )

    service.run()


if __name__ == "__main__":
    main()
