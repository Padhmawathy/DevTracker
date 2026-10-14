
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from devtrack.reminders.action_handler import (
    handle_action_uri,
    parse_action_uri,
)
from devtrack.reminders.action_queue import ReminderActionQueue


class TestReminderActionHandler(unittest.TestCase):

    def test_parse_valid_snooze_uri(self):
        reminder_id = "a" * 32

        action, parsed_id = parse_action_uri(
            f"devtracker-reminder://snooze/{reminder_id}"
        )

        self.assertEqual(action, "snooze")
        self.assertEqual(parsed_id, reminder_id)

    def test_parse_valid_skip_uri(self):
        reminder_id = "b" * 32

        action, parsed_id = parse_action_uri(
            f"devtracker-reminder://skip/{reminder_id}"
        )

        self.assertEqual(action, "skip")
        self.assertEqual(parsed_id, reminder_id)

    def test_invalid_uris_rejected(self):
        invalid_uris = [
            "https://example.com",
            "devtracker-reminder://delete/" + "a" * 32,
            "devtracker-reminder://skip/invalid",
            "devtracker-reminder://skip/" + "a" * 32 + "?x=1",
            "devtracker-reminder://skip/" + "a" * 32 + "/extra",
            "devtracker-reminder://skip@" + "a" * 32 + "/",
        ]

        for uri in invalid_uris:
            with self.subTest(uri=uri):
                with self.assertRaises(ValueError):
                    parse_action_uri(uri)

    def test_handler_queues_matching_action(self):
        with TemporaryDirectory() as folder:
            queue = ReminderActionQueue(
                Path(folder) / "actions.db"
            )
            reminder_id = "c" * 32

            handle_action_uri(
                f"devtracker-reminder://snooze/{reminder_id}",
                queue=queue,
            )

            self.assertEqual(
                queue.consume_for_reminder(reminder_id),
                "snooze",
            )

    def test_handler_rejects_invalid_action(self):
        with TemporaryDirectory() as folder:
            queue = ReminderActionQueue(
                Path(folder) / "actions.db"
            )

            with self.assertRaises(ValueError):
                handle_action_uri(
                    "devtracker-reminder://delete/" + "d" * 32,
                    queue=queue,
                )

            self.assertIsNone(queue.consume())


if __name__ == "__main__":
    unittest.main()
