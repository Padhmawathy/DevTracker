
import unittest
from datetime import date

from devtrack.summary.service import DailySummaryService


class FakeJournalService:
    def get_daily_journal(self, day):
        return {
            "date": day.isoformat(),
            "activities": [
                {
                    "process_name": "Code.exe",
                    "duration_seconds": 120,
                },
                {
                    "process_name": "Code.exe",
                    "duration_seconds": 60,
                },
                {
                    "process_name": "brave.exe",
                    "duration_seconds": 30,
                },
            ],
            "checkins": [
                {
                    "project_name": "DevTracker",
                    "work_description": "Implemented summary service",
                    "category": "Coding",
                    "blocker": None,
                },
                {
                    "project_name": "DevTracker",
                    "work_description": "Fixed an import error",
                    "category": "Debugging",
                    "blocker": "Incorrect module path",
                },
            ],
        }


class TestDailySummaryService(unittest.TestCase):

    def setUp(self):
        self.service = DailySummaryService(
            journal_service=FakeJournalService()
        )
        self.day = date(2026, 10, 9)

    def test_total_tracked_time(self):
        summary = self.service.generate(self.day)

        self.assertEqual(
            summary["total_tracked_seconds"], 210
        )

    def test_application_usage(self):
        summary = self.service.generate(self.day)

        self.assertEqual(
            summary["application_usage"]["Code.exe"], 180
        )
        self.assertEqual(
            summary["application_usage"]["brave.exe"], 30
        )

    def test_project_work(self):
        summary = self.service.generate(self.day)

        project = summary["projects"]["DevTracker"]

        self.assertEqual(len(project["work"]), 2)
        self.assertIn(
            "Implemented summary service",
            project["work"],
        )

    def test_categories(self):
        summary = self.service.generate(self.day)

        self.assertEqual(
            summary["projects"]["DevTracker"]["categories"],
            ["Coding", "Debugging"],
        )

    def test_blockers(self):
        summary = self.service.generate(self.day)

        self.assertEqual(
            summary["projects"]["DevTracker"]["blockers"],
            ["Incorrect module path"],
        )

    def test_counts(self):
        summary = self.service.generate(self.day)

        self.assertEqual(summary["activity_count"], 3)
        self.assertEqual(summary["checkin_count"], 2)


if __name__ == "__main__":
    unittest.main()
