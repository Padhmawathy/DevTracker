
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from devtrack.api.main import app


class TestDevTrackerAPI(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["status"],
            "ok",
        )

    @patch("devtrack.api.main.DailySummaryService")
    def test_today_summary(self, mock_service):
        mock_service.return_value.generate.return_value = {
            "date": "2026-10-09",
            "total_tracked_seconds": 120,
            "application_usage": {"Code.exe": 120},
            "projects": {},
            "activity_count": 1,
            "checkin_count": 0,
        }

        response = self.client.get("/api/summary/today")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["total_tracked_seconds"],
            120,
        )

    @patch("devtrack.api.main.DailyJournalService")
    def test_activity_endpoint(self, mock_service):
        mock_service.return_value.get_daily_journal.return_value = {
            "date": "2026-10-09",
            "activities": [
                {
                    "process_name": "Code.exe",
                    "duration_seconds": 60,
                }
            ],
            "checkins": [],
        }

        response = self.client.get(
            "/api/activity/2026-10-09"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["total_activities"],
            1,
        )

    def test_invalid_activity_date(self):
        response = self.client.get(
            "/api/activity/invalid-date"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "Invalid date. Use YYYY-MM-DD.",
        )


if __name__ == "__main__":
    unittest.main()
