from devtrack.collector.tracker import ActivityTracker


def main():
    tracker = ActivityTracker(
        poll_interval=1
    )

    tracker.run()


if __name__ == "__main__":
    main()