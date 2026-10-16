
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from devtrack.reminders.action_queue import ReminderActionQueue
from devtrack.reminders.state import ReminderState
from devtrack.reminders.state_store import JSONReminderStateStore


class TestReminderPortablePaths(unittest.TestCase):

    def test_state_store_uses_portable_path(self):
        with TemporaryDirectory() as folder:
            expected = Path(folder) / "reminder_state.json"

            with patch(
                "devtrack.reminders.state_store.get_data_path",
                return_value=expected,
            ):
                store = JSONReminderStateStore()

            self.assertEqual(store.path, expected)

    def test_action_queue_uses_portable_path(self):
        with TemporaryDirectory() as folder:
            expected = Path(folder) / "reminder_actions.db"

            with patch(
                "devtrack.reminders.action_queue.get_data_path",
                return_value=expected,
            ):
                queue = ReminderActionQueue()

            self.assertEqual(queue.path, expected)
            self.assertTrue(expected.exists())

    def test_explicit_paths_are_preserved(self):
        with TemporaryDirectory() as folder:
            state_path = Path(folder) / "custom_state.json"
            queue_path = Path(folder) / "custom_queue.db"

            state_store = JSONReminderStateStore(state_path)
            action_queue = ReminderActionQueue(queue_path)

            self.assertEqual(state_store.path, state_path)
            self.assertEqual(action_queue.path, queue_path)

    def test_state_round_trip(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "reminder_state.json"

            store = JSONReminderStateStore(path)
            state = ReminderState()

            store.save(state)
            restored = store.load()

            self.assertEqual(restored, state)
            self.assertTrue(path.exists())

    def test_action_queue_round_trip(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "reminder_actions.db"

            queue = ReminderActionQueue(path)
            queue.enqueue(
                "snooze",
                reminder_id="a" * 32,
            )

            action = queue.consume_for_reminder("a" * 32)

            self.assertEqual(action, "snooze")
            self.assertIsNone(
                queue.consume_for_reminder("a" * 32)
            )


if __name__ == "__main__":
    unittest.main()
