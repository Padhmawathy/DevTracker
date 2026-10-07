from datetime import date

from devtrack.timeline.service import TimelineService


def show_timeline():
    service = TimelineService()
    timeline = service.get_daily_timeline(date.today())

    print()
    print(f"DevTrack — Daily Timeline")
    print(f"{date.today().isoformat()}")
    print("-" * 50)

    if not timeline:
        print("No activity recorded today.")
        return

    for activity in timeline:
        print(
            f"{activity['started_at']} → "
            f"{activity['ended_at']} | "
            f"{activity['process_name']}"
        )

    print("-" * 50)
    print(f"Total activities: {len(timeline)}")


if __name__ == "__main__":
    show_timeline()