import logging
import threading
import time
import unittest
from unittest.mock import MagicMock, patch
from devtrack.desktop_backend import run_backend
class TestCollectorWatchdog(unittest.TestCase):
    def test_stalled_collector_is_logged_without_duplicate_restart(self):
        tracker = MagicMock()
        server = MagicMock()
        collector_started = threading.Event()
        release_collector = threading.Event()
        tracker.last_completed_poll_time = time.monotonic() - 60
        def run_collector():
            collector_started.set()
            release_collector.wait(timeout=8)
        tracker.run.side_effect = run_collector
        def run_server():
            self.assertTrue(collector_started.wait(timeout=2))
            time.sleep(5.5)
            release_collector.set()
        server.run.side_effect = run_server
        with patch("devtrack.desktop_backend.logging.error") as log_error:
            run_backend(tracker=tracker, server=server)
        self.assertTrue(
            any(
                "heartbeat stalled" in str(call)
                for call in log_error.call_args_list
            ),
            "Watchdog did not report the stalled collector",
        )
        tracker.run.assert_called_once()
        tracker.stop.assert_called_once()
if __name__ == "__main__":
    unittest.main()
