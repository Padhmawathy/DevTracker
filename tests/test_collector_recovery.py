import threading
import unittest
from unittest.mock import MagicMock
from devtrack.desktop_backend import run_backend
class TestCollectorRecovery(unittest.TestCase):
    def test_collector_recovers_from_unexpected_failure(self):
        tracker = MagicMock()
        server = MagicMock()
        restarted = threading.Event()
        def collector_run():
            if tracker.run.call_count == 1:
                raise RuntimeError("Simulated collector failure")
            restarted.set()
        tracker.run.side_effect = collector_run
        def server_run():
            restarted.wait(timeout=3)
        server.run.side_effect = server_run
        run_backend(tracker=tracker, server=server)
        self.assertTrue(
            restarted.is_set(),
            "Collector was not restarted after failure",
        )
        self.assertGreaterEqual(tracker.run.call_count, 2)
        tracker.stop.assert_called_once()
if __name__ == "__main__":
    unittest.main()
