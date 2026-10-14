
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from devtrack.reminders.action_queue import ReminderActionQueue


class TestReminderActionQueue(unittest.TestCase):

    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)

        path = Path(self.folder.name) / "actions.db"
        self.queue = ReminderActionQueue(path)

    def test_snooze_action(self):
        self.queue.enqueue("snooze")

        self.assertEqual(
            self.queue.consume(),
            "snooze",
        )

    def test_skip_action(self):
        self.queue.enqueue("skip")

        self.assertEqual(
            self.queue.consume(),
            "skip",
        )

    def test_action_consumed_once(self):
        self.queue.enqueue("snooze")

        self.assertEqual(self.queue.consume(), "snooze")
        self.assertIsNone(self.queue.consume())

    def test_actions_processed_in_order(self):
        self.queue.enqueue("snooze")
        self.queue.enqueue("skip")

        self.assertEqual(self.queue.consume(), "snooze")
        self.assertEqual(self.queue.consume(), "skip")

    def test_invalid_action_rejected(self):
        with self.assertRaises(ValueError):
            self.queue.enqueue("delete_all_data")

    def test_stale_action_discarded(self):
        with patch(
            "devtrack.reminders.action_queue.time.time",
            return_value=1000,
        ):
            self.queue.enqueue("snooze")

        with patch(
            "devtrack.reminders.action_queue.time.time",
            return_value=2000,
        ):
            self.assertIsNone(self.queue.consume())

    
    def test_action_matches_reminder_id(self):
        reminder_id = "a" * 32

        self.queue.enqueue("snooze", reminder_id)

        self.assertEqual(
            self.queue.consume_for_reminder(reminder_id),
            "snooze",
        )

    def test_old_reminder_action_rejected(self):
        old_id = "a" * 32
        current_id = "b" * 32

        self.queue.enqueue("skip", old_id)

        self.assertIsNone(
            self.queue.consume_for_reminder(current_id)
        )

        # Rejected actions must not remain in the queue.
        self.assertIsNone(self.queue.consume())

    def test_legacy_action_rejected_for_current_reminder(self):
        self.queue.enqueue("snooze")

        self.assertIsNone(
            self.queue.consume_for_reminder("c" * 32)
        )

    def test_invalid_reminder_id_rejected(self):
        with self.assertRaises(ValueError):
            self.queue.enqueue("skip", "invalid")

        with self.assertRaises(ValueError):
            self.queue.consume_for_reminder("invalid")

if __name__ == "__main__":
    unittest.main()
