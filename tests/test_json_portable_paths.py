
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from devtrack.storage.json_store import JsonActivityStore


class TestJsonPortablePaths(unittest.TestCase):

    def test_default_path_uses_path_helper(self):
        with TemporaryDirectory() as folder:
            expected = Path(folder) / "activity.jsonl"

            with patch(
                "devtrack.storage.json_store.get_data_path",
                return_value=expected,
            ):
                store = JsonActivityStore()

            self.assertEqual(store.file_path, expected)

    def test_explicit_path_is_preserved(self):
        with TemporaryDirectory() as folder:
            expected = Path(folder) / "custom.jsonl"

            store = JsonActivityStore(expected)

            self.assertEqual(store.file_path, expected)

    def test_activity_is_saved_as_jsonl(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "activity.jsonl"

            class SampleActivity:
                def to_dict(self):
                    return {
                        "process_name": "Code.exe",
                        "duration_seconds": 60,
                    }

            store = JsonActivityStore(path)
            store.save(SampleActivity())

            with path.open("r", encoding="utf-8") as file:
                lines = file.readlines()

            self.assertEqual(len(lines), 1)

            data = json.loads(lines[0])

            self.assertEqual(
                data["process_name"],
                "Code.exe",
            )
            self.assertEqual(
                data["duration_seconds"],
                60,
            )


if __name__ == "__main__":
    unittest.main()
