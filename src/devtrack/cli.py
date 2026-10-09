from datetime import date, datetime

from devtrack.timeline.service import TimelineService


def format_time(timestamp):
    return datetime.fromisoformat(timestamp).strftime("%H:%M:%S")


def show_timeline():
    service = TimelineService()
    timeline = service.get_daily_timeline(date.today())

    print()
    print("DevTrack — Daily Timeline")
    print(date.today().isoformat())
    print("-" * 50)

    if not timeline:
        print("No activity recorded today.")
        return

    for activity in timeline:
        start = format_time(activity["started_at"])
        end = format_time(activity["ended_at"])
        duration = round(activity["duration_seconds"])

        print(
            f"{start} - {end} | "
            f"{duration}s | "
            f"{activity['process_name']}"
        )

    total_seconds = sum(
    	activity["duration_seconds"]
    	for activity in timeline
    )

    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = int(total_seconds % 60)

    print("-" * 50)
    print(f"Total activities: {len(timeline)}")
    print(f"Total tracked time: {hours}h {minutes}m {seconds}s")

if __name__ == "__main__":
    show_timeline()