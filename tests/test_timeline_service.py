import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path

from devtrack.models.activity import Activity
from devtrack.storage.sqlite_store import SQLiteActivityStore
from devtrack.timeline.service import TimelineService


class TestTimelineService(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()

        db_path = Path(self.temp_dir.name) / "test.db"

        self.store = SQLiteActivityStore(db_path)
        self.service = TimelineService(self.store)

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
    ):
        activity = Activity(
            process_name=process_name,
            process_id=1234,
            window_title="Test Window",
            started_at=started_at,
        )

        activity.finish(
            datetime.fromtimestamp(
                started_at.timestamp() + duration_seconds
            )
        )

        return activity

    def test_get_daily_timeline(self):
        activity = self.create_activity(
            "Code.exe",
            datetime(2026, 10, 6, 10, 0, 0),
            30,
        )

        self.store.save(activity)

        timeline = self.service.get_daily_timeline(
            date(2026, 10, 6)
        )

        self.assertEqual(len(timeline), 1)
        self.assertEqual(
            timeline[0]["process_name"],
            "Code.exe",
        )


if __name__ == "__main__":
    unittest.main()