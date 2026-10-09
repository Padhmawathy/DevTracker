
import unittest
from datetime import datetime

from devtrack.models.checkin import DeveloperCheckIn


class TestDeveloperCheckIn(unittest.TestCase):

    def test_create_checkin(self):
        checkin = DeveloperCheckIn(
            project_name="DevTracker",
            work_description="Building Phase 3",
            category="Coding",
        )

        self.assertEqual(checkin.project_name, "DevTracker")
        self.assertEqual(checkin.category, "Coding")
        self.assertIsNone(checkin.blocker)
        self.assertIsInstance(checkin.created_at, datetime)

    def test_checkin_with_blocker(self):
        checkin = DeveloperCheckIn(
            project_name="DevTracker",
            work_description="Testing SQLite storage",
            category="Debugging",
            blocker="Database connection issue",
        )

        self.assertEqual(
            checkin.blocker,
            "Database connection issue",
        )

    def test_checkin_with_custom_timestamp(self):
        timestamp = datetime(2026, 10, 9, 14, 30)

        checkin = DeveloperCheckIn(
            project_name="DevTracker",
            work_description="Writing unit tests",
            category="Testing",
            created_at=timestamp,
        )

        self.assertEqual(checkin.created_at, timestamp)


if __name__ == "__main__":
    unittest.main()
