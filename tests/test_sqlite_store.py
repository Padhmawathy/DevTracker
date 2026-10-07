import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path

from devtrack.models.activity import Activity
from devtrack.storage.sqlite_store import SQLiteActivityStore


class TestSQLiteActivityStore(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()

        db_path = Path(self.temp_dir.name) / "test.db"

        self.store = SQLiteActivityStore(db_path)

    def tearDown(self):
        self.store = None
        try:
            self.temp_dir.cleanup()
        except PermissionError:
            pass

    def create_activity(
        self,
        process_name,
        started_at,
        duration_seconds,
        window_title="Test Window",
    ):
        activity = Activity(
            process_name=process_name,
            process_id=1234,
            window_title=window_title,
            started_at=started_at,
        )

        ended_at = started_at.timestamp() + duration_seconds

        activity.finish(
            datetime.fromtimestamp(ended_at)
        )

        return activity

    def test_save_and_get_recent(self):
        activity = self.create_activity(
            "Code.exe",
            datetime(2026, 10, 6, 10, 0, 0),
            30,
        )

        activity_id = self.store.save(activity)

        rows = self.store.get_recent()

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], activity_id)
        self.assertEqual(rows[0]["process_name"], "Code.exe")

    def test_get_between(self):
        first = self.create_activity(
            "Code.exe",
            datetime(2026, 10, 6, 10, 0, 0),
            30,
        )

        second = self.create_activity(
            "chrome.exe",
            datetime(2026, 10, 6, 11, 0, 0),
            60,
        )

        self.store.save(first)
        self.store.save(second)

        rows = self.store.get_between(
            datetime(2026, 10, 6, 10, 30, 0),
            datetime(2026, 10, 6, 12, 0, 0),
        )

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["process_name"], "chrome.exe")

    def test_get_by_process(self):
        first = self.create_activity(
            "Code.exe",
            datetime(2026, 10, 6, 10, 0, 0),
            30,
        )

        second = self.create_activity(
            "chrome.exe",
            datetime(2026, 10, 6, 11, 0, 0),
            60,
        )

        self.store.save(first)
        self.store.save(second)

        rows = self.store.get_by_process("code.exe")

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["process_name"], "Code.exe")

    def test_usage_summary(self):
        first = self.create_activity(
            "Code.exe",
            datetime(2026, 10, 6, 10, 0, 0),
            30,
        )

        second = self.create_activity(
            "Code.exe",
            datetime(2026, 10, 6, 11, 0, 0),
            20,
        )

        third = self.create_activity(
            "chrome.exe",
            datetime(2026, 10, 6, 12, 0, 0),
            40,
        )

        self.store.save(first)
        self.store.save(second)
        self.store.save(third)

        rows = self.store.get_usage_summary(
            datetime(2026, 10, 6),
            datetime(2026, 10, 7),
        )

        self.assertEqual(rows[0]["process_name"], "Code.exe")
        self.assertEqual(rows[0]["total_seconds"], 50)
        self.assertEqual(rows[0]["activity_count"], 2)

        self.assertEqual(rows[1]["process_name"], "chrome.exe")
        self.assertEqual(rows[1]["total_seconds"], 40)
        self.assertEqual(rows[1]["activity_count"], 1)

    def test_daily_timeline(self):
        activity = self.create_activity(
            "Code.exe",
            datetime(2026, 10, 6, 14, 0, 0),
            30,
        )

        self.store.save(activity)

        rows = self.store.get_daily_timeline(
            date(2026, 10, 6)
        )

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["process_name"], "Code.exe")

    def test_daily_summary(self):
        first = self.create_activity(
            "Code.exe",
            datetime(2026, 10, 6, 14, 0, 0),
            30,
        )

        second = self.create_activity(
            "chrome.exe",
            datetime(2026, 10, 6, 15, 0, 0),
            60,
        )

        self.store.save(first)
        self.store.save(second)

        summary = self.store.get_daily_summary(
            date(2026, 10, 6)
        )

        self.assertEqual(summary["date"], "2026-10-06")
        self.assertEqual(summary["activity_count"], 2)
        self.assertEqual(summary["application_count"], 2)
        self.assertEqual(summary["total_seconds"], 90)


if __name__ == "__main__":
    unittest.main()