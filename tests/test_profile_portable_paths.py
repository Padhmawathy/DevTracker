
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from devtrack.models.profile import DeveloperProfile
from devtrack.storage.profile_store import JSONDeveloperProfileStore


class TestProfilePortablePaths(unittest.TestCase):

    def test_default_path_uses_path_helper(self):
        expected = Path("example") / "developer_profile.json"

        with patch(
            "devtrack.storage.profile_store.get_data_path",
            return_value=expected,
        ):
            store = JSONDeveloperProfileStore()

        self.assertEqual(store.path, expected)

    def test_explicit_path_is_preserved(self):
        custom_path = Path("custom") / "profile.json"

        store = JSONDeveloperProfileStore(custom_path)

        self.assertEqual(store.path, custom_path)

    def test_save_and_load_with_portable_path(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "developer_profile.json"

            with patch(
                "devtrack.storage.profile_store.get_data_path",
                return_value=path,
            ):
                store = JSONDeveloperProfileStore()

                profile = DeveloperProfile(
                    display_name="Developer One",
                    role="backend",
                    primary_language="Python",
                    primary_editor="VS Code",
                    daily_focus_goal_minutes=300,
                )

                store.save(profile)
                restored = store.load()

            self.assertEqual(restored, profile)
            self.assertTrue(path.exists())


if __name__ == "__main__":
    unittest.main()
