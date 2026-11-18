from pathlib import Path

"""Unified backend entry point for the DevTrack desktop app."""

import threading
import logging
import os
from logging.handlers import RotatingFileHandler
import sys
import uvicorn

from devtrack.api.main import app
from devtrack.collector.tracker import ActivityTracker

def configure_backend_logging():
    log_dir = Path(os.environ["LOCALAPPDATA"]) / "DevTrack" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger()
    if not any(
        isinstance(handler, RotatingFileHandler)
        and Path(handler.baseFilename) == log_dir / "backend.log"
        for handler in logger.handlers
    ):
        handler = RotatingFileHandler(
            log_dir / "backend.log",
            maxBytes=1_000_000,
            backupCount=3,
            encoding="utf-8",
        )
        handler.setFormatter(logging.Formatter(
            "%(asctime)s %(levelname)s %(message)s"
        ))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
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

    configure_backend_logging()

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

    collector_shutdown = threading.Event()
    def supervise_collector():
        while not collector_shutdown.is_set():
            try:
                tracker.run()
            except Exception:
                logging.exception(
                    "[DEVTRACK] Activity collector crashed"
                )
                if collector_shutdown.is_set():
                    break
                logging.warning(
                    "[DEVTRACK] Restarting activity collector"
                )
                if collector_shutdown.wait(1):
                    break
                # Reset stale stop state only during crash recovery.
                if collector_shutdown.is_set():
                    break
                stop_event = getattr(tracker, "stop_event", None)
                if stop_event is not None:
                    stop_event.clear()
                if collector_shutdown.is_set():
                    tracker.stop()
                    break
            else:
                if not collector_shutdown.is_set():
                    logging.error(
                        "[DEVTRACK] Collector exited unexpectedly without an exception"
                    )
                break
    collector_thread = threading.Thread(
        target=supervise_collector,
        name="DevTrackCollector",
        daemon=False,
    )

    collector_thread.start()
    def monitor_collector():
        while not collector_shutdown.wait(5):
            if not collector_thread.is_alive():
                logging.error(
                    "[DEVTRACK] Collector supervisor stopped unexpectedly"
                )
                return
            heartbeat = getattr(
                tracker, "last_completed_poll_time", None
            )
            if not isinstance(heartbeat, (int, float)):
                continue
            import time
            age = time.monotonic() - heartbeat
            if age > 30:
                logging.error(
                    "[DEVTRACK] Collector heartbeat stalled for %.1f seconds",
                    age,
                )
    watchdog_thread = threading.Thread(
        target=monitor_collector,
        name="DevTrackCollectorWatchdog",
        daemon=True,
    )
    watchdog_thread.start()
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
        collector_shutdown.set()
        tracker.stop()
        collector_thread.join(timeout=10)

        if collector_thread.is_alive():
            raise RuntimeError(
                "DevTrack collector did not stop cleanly"
            )


def main():
    managed = len(sys.argv) == 2 and sys.argv[1] == "--managed"

    if managed:
        # Read the token before starting the HTTP server.
        # The rest of stdin remains available for shutdown.
        startup_line = sys.stdin.readline().strip()

        if not startup_line.startswith("auth "):
            raise RuntimeError(
                "Missing desktop authentication handshake"
            )

        token = startup_line[5:]

        if len(token) < 32:
            raise RuntimeError("Invalid desktop authentication token")

        app.state.desktop_api_token = token

    run_backend(managed=managed)



if __name__ == "__main__":
    main()
