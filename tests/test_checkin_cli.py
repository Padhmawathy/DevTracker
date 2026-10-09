
import unittest
from unittest.mock import patch, MagicMock

from devtrack.checkin_cli import main


class TestCheckInCLI(unittest.TestCase):

    @patch("devtrack.checkin_cli.SQLiteCheckInStore")
    @patch("builtins.input")
    def test_successful_checkin(self, mock_input, mock_store):
        mock_input.side_effect = [
            "DevTracker",
            "Building CLI",
            "Coding",
            "",
        ]

        mock_store.return_value.save.return_value = 1

        main()

        mock_store.return_value.save.assert_called_once()

        saved_checkin = (
            mock_store.return_value.save.call_args.args[0]
        )

        self.assertEqual(
            saved_checkin.project_name, "DevTracker"
        )
        self.assertEqual(
            saved_checkin.work_description, "Building CLI"
        )
        self.assertEqual(saved_checkin.category, "Coding")
        self.assertIsNone(saved_checkin.blocker)

    @patch("devtrack.checkin_cli.SQLiteCheckInStore")
    @patch("builtins.input")
    def test_empty_project_name(self, mock_input, mock_store):
        mock_input.side_effect = [""]

        main()

        mock_store.assert_not_called()

    @patch("devtrack.checkin_cli.SQLiteCheckInStore")
    @patch("builtins.input")
    def test_empty_work_description(
        self, mock_input, mock_store
    ):
        mock_input.side_effect = [
            "DevTracker",
            "",
        ]

        main()

        mock_store.assert_not_called()


if __name__ == "__main__":
    unittest.main()
