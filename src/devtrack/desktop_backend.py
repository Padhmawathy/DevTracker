
"""Unified backend entry point for the DevTrack desktop app."""

import threading

import uvicorn

from devtrack.api.main import app
from devtrack.collector.tracker import ActivityTracker


def run_backend(
    host="127.0.0.1",
    port=8000,
    tracker=None,
    server=None,
):
    """Run the API and activity collector together."""

    if tracker is None:
        tracker = ActivityTracker()

    if server is None:
        config = uvicorn.Config(
            app,
            host=host,
            port=port,
            log_level="info",
        )
        server = uvicorn.Server(config)

    collector_thread = threading.Thread(
        target=tracker.run,
        name="DevTrackCollector",
        daemon=False,
    )

    collector_thread.start()

    try:
        server.run()

    except KeyboardInterrupt:
        print("\n[DEVTRACK] Shutdown requested.")

    finally:
        tracker.stop()
        collector_thread.join(timeout=10)

        if collector_thread.is_alive():
            raise RuntimeError(
                "DevTrack collector did not stop cleanly"
            )


def main():
    run_backend()


if __name__ == "__main__":
    main()
