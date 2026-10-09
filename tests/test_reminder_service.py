
import unittest
from unittest.mock import patch

from devtrack.reminders.service import CheckInReminderService


class TestCheckInReminderService(unittest.TestCase):

    def test_default_interval(self):
        service = CheckInReminderService()

        self.assertEqual(service.interval_seconds, 3600)

    def test_custom_interval(self):
        service = CheckInReminderService(
            interval_minutes=30
        )

        self.assertEqual(service.interval_seconds, 1800)

    def test_invalid_interval(self):
        with self.assertRaises(ValueError):
            CheckInReminderService(
                interval_minutes=0
            )

    @patch("builtins.print")
    def test_reminder_message(self, mock_print):
        service = CheckInReminderService()

        service.show_reminder()

        printed_text = " ".join(
            str(call)
            for call in mock_print.call_args_list
        )

        self.assertIn(
            "Developer Check-in Reminder",
            printed_text
        )

        self.assertIn(
            "python -m devtrack.checkin_cli",
            printed_text
        )


if __name__ == "__main__":
    unittest.main()
