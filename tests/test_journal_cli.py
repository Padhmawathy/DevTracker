
import unittest
from unittest.mock import patch
from datetime import date
from io import StringIO

from devtrack.journal_cli import main


class TestJournalCLI(unittest.TestCase):

    @patch("devtrack.journal_cli.DailyJournalService")
    @patch("sys.argv", ["journal_cli", "--date", "2026-10-09"])
    @patch("sys.stdout", new_callable=StringIO)
    def test_journal_with_data(self, mock_stdout, mock_service):
        mock_service.return_value.get_daily_journal.return_value = {
            "date": "2026-10-09",
            "activities": [
                {
                    "started_at": "2026-10-09T10:00:00",
                    "ended_at": "2026-10-09T10:05:00",
                    "process_name": "Code.exe",
                    "duration_seconds": 300,
                }
            ],
            "checkins": [
                {
                    "created_at": "2026-10-09T10:05:00",
                    "project_name": "DevTracker",
                    "category": "Coding",
                    "work_description": "Building journal CLI",
                    "blocker": None,
                }
            ],
        }

        main()
        output = mock_stdout.getvalue()

        self.assertIn("Code.exe", output)
        self.assertIn("DevTracker", output)
        self.assertIn("Building journal CLI", output)
        mock_service.return_value.get_daily_journal.assert_called_once_with(
            date(2026, 10, 9)
        )

    @patch("devtrack.journal_cli.DailyJournalService")
    @patch("sys.argv", ["journal_cli", "--date", "2026-10-07"])
    @patch("sys.stdout", new_callable=StringIO)
    def test_empty_journal(self, mock_stdout, mock_service):
        mock_service.return_value.get_daily_journal.return_value = {
            "date": "2026-10-07",
            "activities": [],
            "checkins": [],
        }

        main()
        output = mock_stdout.getvalue()

        self.assertIn("No application activity recorded.", output)
        self.assertIn("No developer check-ins recorded.", output)

    @patch("devtrack.journal_cli.DailyJournalService")
    @patch("sys.argv", ["journal_cli", "--date", "2026-10-09"])
    @patch("sys.stdout", new_callable=StringIO)
    def test_journal_with_blocker(self, mock_stdout, mock_service):
        mock_service.return_value.get_daily_journal.return_value = {
            "date": "2026-10-09",
            "activities": [],
            "checkins": [
                {
                    "created_at": "2026-10-09T11:00:00",
                    "project_name": "DevTracker",
                    "category": "Debugging",
                    "work_description": "Fixing database issue",
                    "blocker": "SQLite connection error",
                }
            ],
        }

        main()
        output = mock_stdout.getvalue()

        self.assertIn("Blocker: SQLite connection error", output)


if __name__ == "__main__":
    unittest.main()
