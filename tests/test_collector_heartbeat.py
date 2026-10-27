import time
import unittest
from unittest.mock import MagicMock
from devtrack.collector.tracker import ActivityTracker
class TestCollectorHeartbeat(unittest.TestCase):
    def test_poll_timestamp_updates(self):
        tracker = ActivityTracker(
            store=MagicMock(),
            reminder_state_store=MagicMock(),
        )
        previous = tracker.last_poll_time
        time.sleep(0.02)
        tracker.detect_tracking_gap()
        self.assertGreater(
            tracker.last_poll_time,
            previous,
        )
if __name__ == "__main__":
    unittest.main()
