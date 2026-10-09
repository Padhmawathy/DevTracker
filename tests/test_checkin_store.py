
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path

from devtrack.models.checkin import DeveloperCheckIn
from devtrack.storage.checkin_store import SQLiteCheckInStore


class TestSQLiteCheckInStore(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        db_path = Path(self.temp_dir.name) / "test.db"
        self.store = SQLiteCheckInStore(db_path)

    def tearDown(self):
        self.store = None
        try:
            self.temp_dir.cleanup()
        except PermissionError:
            pass

    def test_save_checkin(self):
        checkin = DeveloperCheckIn(
            project_name="DevTracker",
            work_description="Implementing SQLite storage",
            category="Coding",
        )

        checkin_id = self.store.save(checkin)

        self.assertEqual(checkin_id, 1)

    def test_retrieve_daily_checkins(self):
        checkin = DeveloperCheckIn(
            project_name="DevTracker",
            work_description="Testing database",
            category="Testing",
            created_at=datetime(2026, 10, 9, 10, 30),
        )

        self.store.save(checkin)

        results = self.store.get_daily_checkins(
            date(2026, 10, 9)
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(
            results[0]["work_description"],
            "Testing database",
        )
        self.assertEqual(results[0]["category"], "Testing")

    def test_excludes_other_days(self):
        checkin = DeveloperCheckIn(
            project_name="DevTracker",
            work_description="Previous day's work",
            category="Coding",
            created_at=datetime(2026, 10, 8, 15, 0),
        )

        self.store.save(checkin)

        results = self.store.get_daily_checkins(
            date(2026, 10, 9)
        )

        self.assertEqual(len(results), 0)


if __name__ == "__main__":
    unittest.main()
