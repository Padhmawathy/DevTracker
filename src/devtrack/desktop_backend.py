
"""Unified backend entry point for the DevTrack desktop app."""

import threading
import sys
import uvicorn

from devtrack.api.main import app
from devtrack.collector.tracker import ActivityTracker

def listen_for_shutdown(server, input_stream):
    """Accept shutdown requests from the desktop application."""
    for line in input_stream:
        if line.strip() == "shutdown":
            server.should_exit = True
            return

    # If the desktop process closes its input pipe,
    # request shutdown rather than leaving tracking running.
    server.should_exit = True


def run_backend(
    host="127.0.0.1",
    port=8000,
    tracker=None,
    server=None,
    managed = False,
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
    if managed:
        shutdown_thread = threading.Thread(
            target=listen_for_shutdown,
            args=(server, sys.stdin),
            name="DevTrackShutdownListener",
            daemon=True,
        )
        shutdown_thread.start()
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
    managed = len(sys.argv) == 2 and sys.argv[1] == "--managed"
    run_backend(managed=managed)


if __name__ == "__main__":
    main()
