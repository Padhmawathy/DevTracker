from devtrack.collector.tracker import ActivityTracker


def main():
    tracker = ActivityTracker(
        poll_interval=1,
        idle_threshold=300,
        min_activity_duration=2,
    )

    tracker.run()


if __name__ == "__main__":
    main()