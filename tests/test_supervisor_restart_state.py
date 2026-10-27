import threading
import unittest
from unittest.mock import MagicMock
from devtrack.desktop_backend import run_backend
class TestSupervisorRestartState(unittest.TestCase):
    def test_supervisor_clears_stale_stop_event_before_restart(self):
        tracker = MagicMock()
        tracker.stop_event = threading.Event()
        server = MagicMock()
        restarted = threading.Event()
        calls = []
        def collector_run():
            calls.append(tracker.stop_event.is_set())
            if len(calls) == 1:
                tracker.stop_event.set()
                raise RuntimeError("Simulated collector crash")
            if not tracker.stop_event.is_set():
                restarted.set()
        tracker.run.side_effect = collector_run
        def server_run():
            self.assertTrue(
                restarted.wait(timeout=4),
                "Collector did not restart with a cleared stop event",
            )
        server.run.side_effect = server_run
        run_backend(tracker=tracker, server=server)
        self.assertEqual(calls[:2], [False, False])
        self.assertGreaterEqual(tracker.run.call_count, 2)
        tracker.stop.assert_called_once()
if __name__ == "__main__":
    unittest.main()
