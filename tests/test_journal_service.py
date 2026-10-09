
import unittest
from datetime import date
from unittest.mock import MagicMock

from devtrack.journal.service import DailyJournalService


class TestDailyJournalService(unittest.TestCase):

    def setUp(self):
        self.activity_store = MagicMock()
        self.checkin_store = MagicMock()

        self.service = DailyJournalService(
            activity_store=self.activity_store,
            checkin_store=self.checkin_store,
        )

    def test_combines_activities_and_checkins(self):
        day = date(2026, 10, 9)

        self.activity_store.get_daily_timeline_grouped.return_value = [
            {
                "process_name": "Code.exe",
                "duration_seconds": 120,
            }
        ]

        self.checkin_store.get_daily_checkins.return_value = [
            {
                "project_name": "DevTracker",
                "category": "Coding",
            }
        ]

        journal = self.service.get_daily_journal(day)

        self.assertEqual(journal["date"], "2026-10-09")
        self.assertEqual(len(journal["activities"]), 1)
        self.assertEqual(len(journal["checkins"]), 1)

        self.activity_store.get_daily_timeline_grouped.assert_called_once_with(day)
        self.checkin_store.get_daily_checkins.assert_called_once_with(day)

    def test_empty_journal(self):
        day = date(2026, 10, 7)

        self.activity_store.get_daily_timeline_grouped.return_value = []
        self.checkin_store.get_daily_checkins.return_value = []

        journal = self.service.get_daily_journal(day)

        self.assertEqual(journal["activities"], [])
        self.assertEqual(journal["checkins"], [])

    def test_checkins_without_activities(self):
        day = date(2026, 10, 9)

        self.activity_store.get_daily_timeline_grouped.return_value = []
        self.checkin_store.get_daily_checkins.return_value = [
            {"project_name": "DevTracker"}
        ]

        journal = self.service.get_daily_journal(day)

        self.assertEqual(len(journal["activities"]), 0)
        self.assertEqual(len(journal["checkins"]), 1)


if __name__ == "__main__":
    unittest.main()
