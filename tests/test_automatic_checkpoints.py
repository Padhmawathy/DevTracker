import threading
import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from devtrack.collector.tracker import ActivityTracker
from devtrack.models.activity import Activity
class TestAutomaticCheckpoints(unittest.TestCase):
    def test_running_collector_saves_checkpoint(self):
        store = MagicMock()
        tracker = ActivityTracker(store=store)
        tracker.poll_interval = 0.01
        tracker.current_activity = Activity(
            process_name='brave.exe',
            process_id=123,
            window_title='Browser',
            started_at=datetime.now() - timedelta(seconds=31),
        )
        tracker.last_window = ('brave.exe', 'Browser')
        window = {
            'process_name': 'brave.exe',
            'process_id': 123,
            'window_title': 'Browser',
        }
        with patch.object(tracker, 'check_lock_state'), \
             patch.object(tracker, 'check_reminder'), \
             patch.object(tracker, 'apply_settings', return_value=True), \
             patch('devtrack.collector.tracker.get_idle_seconds', return_value=0), \
             patch('devtrack.collector.tracker.get_active_window', return_value=window):
            worker = threading.Thread(target=tracker.run)
            worker.start()
            try:
                deadline = threading.Event()
                for _ in range(100):
                    if store.save.call_count:
                        break
                    deadline.wait(0.02)
                self.assertGreaterEqual(store.save.call_count, 1)
                saved = store.save.call_args_list[0].args[0]
                self.assertGreaterEqual(saved.duration_seconds, 30)
            finally:
                tracker.stop()
                worker.join(timeout=3)
        self.assertFalse(worker.is_alive())
if __name__ == '__main__':
    unittest.main()
