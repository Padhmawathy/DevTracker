
import argparse
from datetime import date

from devtrack.journal.service import DailyJournalService


def main():
    parser = argparse.ArgumentParser(
        description="View your DevTracker daily work journal"
    )

    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=date.today(),
        help="Journal date in YYYY-MM-DD format",
    )

    args = parser.parse_args()

    service = DailyJournalService()
    journal = service.get_daily_journal(args.date)

    print("\n" + "=" * 50)
    print("DEVTRACKER — DAILY WORK JOURNAL")
    print("=" * 50)
    print(f"Date: {journal['date']}")

    print("\n--- APPLICATION ACTIVITY ---")

    activities = journal["activities"]

    if not activities:
        print("No application activity recorded.")
    else:
        for activity in activities:
            print(
                f"{activity['started_at'][11:19]} - "
                f"{activity['ended_at'][11:19]} | "
                f"{activity['process_name']} | "
                f"{activity['duration_seconds']:.0f}s"
            )

    print("\n--- DEVELOPER CHECK-INS ---")

    checkins = journal["checkins"]

    if not checkins:
        print("No developer check-ins recorded.")
    else:
        for checkin in checkins:
            print(f"\nTime: {checkin['created_at'][11:19]}")
            print(f"Project: {checkin['project_name']}")
            print(f"Category: {checkin['category']}")
            print(f"Work: {checkin['work_description']}")

            if checkin["blocker"]:
                print(f"Blocker: {checkin['blocker']}")

    print("\n" + "=" * 50)
    print("End of Daily Journal")
    print("=" * 50)


if __name__ == "__main__":
    main()
