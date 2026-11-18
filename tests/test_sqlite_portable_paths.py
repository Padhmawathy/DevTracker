
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from devtrack.storage.sqlite_store import SQLiteActivityStore


class TestSQLitePortablePaths(unittest.TestCase):

    def test_default_path_uses_path_helper(self):
        with TemporaryDirectory() as folder:
            expected = Path(folder) / "devtrack.db"

            with patch(
                "devtrack.storage.sqlite_store.get_data_path",
                return_value=expected,
            ):
                store = SQLiteActivityStore()

            self.assertEqual(store.db_path, expected)
            self.assertTrue(expected.exists())

    def test_explicit_database_path_is_preserved(self):
        with TemporaryDirectory() as folder:
            custom_path = Path(folder) / "custom.db"

            store = SQLiteActivityStore(custom_path)

            self.assertEqual(store.db_path, custom_path)
            self.assertTrue(custom_path.exists())

    def test_default_database_is_usable(self):
        with TemporaryDirectory() as folder:
            database_path = Path(folder) / "devtrack.db"

            with patch(
                "devtrack.storage.sqlite_store.get_data_path",
                return_value=database_path,
            ):
                store = SQLiteActivityStore()

                recent = store.get_recent()

            self.assertEqual(recent, [])
            self.assertTrue(database_path.exists())


if __name__ == "__main__":
    unittest.main()
