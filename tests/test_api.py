
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from devtrack.api.main import app


class TestDevTrackerAPI(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    # ==========================================
    # 1. HEALTH ENDPOINT
    # ==========================================

    def test_health_endpoint(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["status"],
            "ok",
        )

    # ==========================================
    # 2. TODAY'S SUMMARY
    # ==========================================

    @patch("devtrack.api.main.DailySummaryService")
    def test_today_summary(self, mock_service):
        mock_service.return_value.generate.return_value = {
            "date": "2026-10-09",
            "total_tracked_seconds": 120,
            "application_usage": {
                "Code.exe": 120,
            },
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

    # ==========================================
    # 3. ACTIVITY TIMELINE
    # ==========================================

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

    # ==========================================
    # 4. INVALID ACTIVITY DATE
    # ==========================================

    def test_invalid_activity_date(self):
        response = self.client.get(
            "/api/activity/invalid-date"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "Invalid date. Use YYYY-MM-DD.",
        )

    # ==========================================
    # 5. CREATE DEVELOPER CHECK-IN
    # ==========================================

    @patch("devtrack.api.main.SQLiteCheckInStore")
    def test_create_checkin(self, mock_store):
        mock_store.return_value.save.return_value = 42

        response = self.client.post(
            "/api/checkins",
            json={
                "project_name": "DevTracker",
                "work_description": "Building the React frontend",
                "category": "Coding",
                "blocker": None,
            },
        )

        self.assertEqual(response.status_code, 201)

        data = response.json()

        self.assertEqual(data["id"], 42)
        self.assertEqual(
            data["project_name"],
            "DevTracker",
        )
        self.assertEqual(
            data["work_description"],
            "Building the React frontend",
        )
        self.assertEqual(data["category"], "Coding")
        self.assertIsNone(data["blocker"])
        self.assertIn("created_at", data)

        mock_store.return_value.save.assert_called_once()

    # ==========================================
    # 6. REJECT EMPTY PROJECT NAME
    # ==========================================

    def test_create_checkin_rejects_empty_project(self):
        response = self.client.post(
            "/api/checkins",
            json={
                "project_name": "   ",
                "work_description": "Working on API",
                "category": "Coding",
            },
        )

        self.assertEqual(response.status_code, 422)

    # ==========================================
    # 7. GET DAILY CHECK-INS
    # ==========================================

    @patch("devtrack.api.main.SQLiteCheckInStore")
    def test_get_daily_checkins(self, mock_store):
        mock_store.return_value.get_daily_checkins.return_value = [
            {
                "id": 42,
                "project_name": "DevTracker",
                "work_description": "Building the React frontend",
                "category": "Coding",
                "blocker": None,
                "created_at": "2026-10-09T16:00:00",
            }
        ]

        response = self.client.get(
            "/api/checkins/2026-10-09"
        )

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertEqual(
            data["date"],
            "2026-10-09",
        )
        self.assertEqual(
            data["total_checkins"],
            1,
        )
        self.assertEqual(
            data["checkins"][0]["id"],
            42,
        )
        self.assertEqual(
            data["checkins"][0]["project_name"],
            "DevTracker",
        )

    
    @patch("devtrack.api.main.DailySummaryService")
    def test_get_daily_report(self, mock_service):
        mock_service.return_value.generate.return_value = {
            "date": "2026-10-09",
            "total_tracked_seconds": 143.292884,
            "application_usage": {
                "Code.exe": 27.090587,
            },
            "projects": {
                "DevTracker": {
                    "work": ["Building the Check-ins API"],
                    "categories": ["Coding"],
                    "blockers": [],
                }
            },
            "activity_count": 8,
            "checkin_count": 3,
        }

        response = self.client.get(
            "/api/reports/2026-10-09"
        )

        self.assertEqual(response.status_code, 200)

        data = response.json()
        self.assertEqual(data["date"], "2026-10-09")
        self.assertEqual(data["activity_count"], 8)
        self.assertEqual(data["checkin_count"], 3)
        self.assertIn("DevTracker", data["projects"])

        from datetime import date
        mock_service.return_value.generate.assert_called_once_with(
            date(2026, 10, 9)
        )

    def test_get_daily_report_invalid_date(self):
        response = self.client.get(
            "/api/reports/invalid-date"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "Invalid date. Use YYYY-MM-DD.",
        )

    
    @patch("devtrack.api.main.DailySummaryService")
    def test_download_daily_report(self, mock_service):
        mock_service.return_value.generate.return_value = {
            "date": "2026-10-09",
            "total_tracked_seconds": 120,
            "application_usage": {"Code.exe": 120},
            "projects": {
                "DevTracker": {
                    "work": ["Building the Reports API"],
                    "categories": ["Coding"],
                    "blockers": [],
                }
            },
            "activity_count": 1,
            "checkin_count": 1,
        }

        response = self.client.get(
            "/api/reports/2026-10-09/download"
        )

        self.assertEqual(response.status_code, 200)

        self.assertIn(
            "text/markdown",
            response.headers["content-type"],
        )

        self.assertIn(
            'filename="2026-10-09.md"',
            response.headers["content-disposition"],
        )

        self.assertIn(
            "# DevTracker — Daily Work Report",
            response.text,
        )

        self.assertIn(
            "Building the Reports API",
            response.text,
        )

    def test_download_daily_report_invalid_date(self):
        response = self.client.get(
            "/api/reports/invalid-date/download"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()["detail"],
            "Invalid date. Use YYYY-MM-DD.",
        )

    
    # ==========================================
    # SETTINGS API TESTS
    # ==========================================

    @patch("devtrack.api.main.JSONSettingsStore")
    def test_get_tracker_settings(self, mock_store):
        from devtrack.models.settings import TrackerSettings

        expected = TrackerSettings(
            tracking_enabled=True,
            poll_interval=1,
            idle_threshold=300,
            min_activity_duration=2,
            collect_window_titles=False,
        )

        mock_store.return_value.load.return_value = expected

        response = self.client.get("/api/settings")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), expected.to_dict())
        mock_store.return_value.load.assert_called_once()

    @patch("devtrack.api.main.JSONSettingsStore")
    def test_update_tracker_settings(self, mock_store):
        payload = {
            "tracking_enabled": False,
            "poll_interval": 2,
            "idle_threshold": 600,
            "min_activity_duration": 5,
            "collect_window_titles": False,
        }

        response = self.client.put(
            "/api/settings",
            json=payload,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), payload)

        mock_store.return_value.save.assert_called_once()

        saved_settings = (
            mock_store.return_value.save.call_args.args[0]
        )

        self.assertEqual(
            saved_settings.tracking_enabled,
            False,
        )
        self.assertEqual(saved_settings.idle_threshold, 600)

    @patch("devtrack.api.main.JSONSettingsStore")
    def test_reject_invalid_tracker_settings(self, mock_store):
        payload = {
            "tracking_enabled": True,
            "poll_interval": 0,
            "idle_threshold": 300,
            "min_activity_duration": 2,
            "collect_window_titles": True,
        }

        response = self.client.put(
            "/api/settings",
            json=payload,
        )

        self.assertEqual(response.status_code, 422)
        mock_store.return_value.save.assert_not_called()

if __name__ == "__main__":
    unittest.main()
