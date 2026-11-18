
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from devtrack.config.paths import (
    get_data_directory,
    get_data_path,
)


class TestApplicationPaths(unittest.TestCase):

    def test_development_uses_project_data_directory(self):
        with patch(
            "devtrack.config.paths.is_packaged",
            return_value=False,
        ):
            directory = get_data_directory()

        self.assertEqual(directory.name, "data")
        self.assertEqual(directory.parent.name, "DevTracker")

    def test_packaged_uses_local_app_data(self):
        with TemporaryDirectory() as folder:
            with patch(
                "devtrack.config.paths.is_packaged",
                return_value=True,
            ):
                with patch.dict(
                    "os.environ",
                    {"LOCALAPPDATA": folder},
                ):
                    directory = get_data_directory()

            self.assertEqual(
                directory,
                Path(folder) / "DevTrack",
            )

    def test_file_path_is_inside_data_directory(self):
        path = get_data_path("settings.json")

        self.assertEqual(path.name, "settings.json")
        self.assertEqual(
            path.parent,
            get_data_directory(),
        )

    def test_directory_traversal_is_rejected(self):
        for name in [
            "../secret.txt",
            "..\\secret.txt",
            "folder/data.json",
            "",
            ".",
            "..",
        ]:
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    get_data_path(name)

    def test_missing_local_app_data_rejected(self):
        with patch(
            "devtrack.config.paths.is_packaged",
            return_value=True,
        ):
            with patch.dict(
                "os.environ",
                {},
                clear=True,
            ):
                with self.assertRaises(RuntimeError):
                    get_data_directory()


if __name__ == "__main__":
    unittest.main()
