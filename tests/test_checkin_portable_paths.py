
import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from contextlib import closing
from devtrack.storage.checkin_store import SQLiteCheckInStore
from devtrack.storage.sqlite_store import SQLiteActivityStore


class TestCheckinPortablePaths(unittest.TestCase):

    def test_default_path_uses_path_helper(self):
        with TemporaryDirectory() as folder:
            expected = Path(folder) / "devtrack.db"

            with patch(
                "devtrack.storage.checkin_store.get_data_path",
                return_value=expected,
            ):
                store = SQLiteCheckInStore()

            self.assertEqual(store.db_path, expected)
            self.assertTrue(expected.exists())

    def test_explicit_path_is_preserved(self):
        with TemporaryDirectory() as folder:
            custom_path = Path(folder) / "custom.db"

            store = SQLiteCheckInStore(custom_path)

            self.assertEqual(store.db_path, custom_path)
            self.assertTrue(custom_path.exists())

    def test_activity_and_checkins_share_database(self):
        with TemporaryDirectory() as folder:
            shared_path = Path(folder) / "devtrack.db"

            with patch(
                "devtrack.storage.sqlite_store.get_data_path",
                return_value=shared_path,
            ), patch(
                "devtrack.storage.checkin_store.get_data_path",
                return_value=shared_path,
            ):
                activity_store = SQLiteActivityStore()
                checkin_store = SQLiteCheckInStore()

            self.assertEqual(
                activity_store.db_path,
                checkin_store.db_path,
            )

            with closing(sqlite3.connect(shared_path)) as connection:
                tables = {
                    row[0]
                    for row in connection.execute(
                        """
                        SELECT name FROM sqlite_master
                        WHERE type = 'table'
                        """
                    ).fetchall()
                }

            self.assertIn("activities", tables)
            self.assertIn("checkins", tables)

    def test_database_connections_are_closed(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "devtrack.db"

            store = SQLiteCheckInStore(path)

            self.assertEqual(
                store.get_daily_checkins(
                    __import__("datetime").date.today()
                ),
                [],
            )

            # Windows can delete the DB only if no handle remains open.
            path.unlink()

            self.assertFalse(path.exists())


if __name__ == "__main__":
    unittest.main()
