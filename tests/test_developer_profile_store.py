
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from devtrack.models.profile import DeveloperProfile
from devtrack.storage.profile_store import JSONDeveloperProfileStore


class TestDeveloperProfileStore(unittest.TestCase):

    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)

        self.path = Path(self.folder.name) / "profile.json"
        self.store = JSONDeveloperProfileStore(self.path)

    def test_missing_file_returns_default_profile(self):
        profile = self.store.load()

        self.assertEqual(profile, DeveloperProfile())
        self.assertFalse(self.path.exists())

    def test_save_and_load_profile(self):
        profile = DeveloperProfile(
            display_name="Developer One",
            role="backend",
            primary_language="Python",
            primary_editor="VS Code",
            daily_focus_goal_minutes=300,
        )

        self.store.save(profile)
        restored = self.store.load()

        self.assertEqual(restored, profile)

    def test_saved_profile_is_valid_json(self):
        self.store.save(
            DeveloperProfile(display_name="Developer One")
        )

        with self.path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        self.assertEqual(data["display_name"], "Developer One")
        self.assertEqual(data["role"], "fullstack")

    def test_invalid_json_structure_rejected(self):
        self.path.write_text(
            json.dumps(["not", "an", "object"]),
            encoding="utf-8",
        )

        with self.assertRaises(ValueError):
            self.store.load()

    def test_invalid_profile_value_rejected(self):
        self.path.write_text(
            json.dumps({
                "role": "invalid-role",
            }),
            encoding="utf-8",
        )

        with self.assertRaises(ValueError):
            self.store.load()

    def test_missing_fields_use_defaults(self):
        self.path.write_text(
            json.dumps({
                "display_name": "Developer One",
            }),
            encoding="utf-8",
        )

        profile = self.store.load()

        self.assertEqual(profile.display_name, "Developer One")
        self.assertEqual(profile.role, "fullstack")
        self.assertEqual(
            profile.daily_focus_goal_minutes,
            240,
        )

    def test_unknown_fields_are_ignored(self):
        self.path.write_text(
            json.dumps({
                "display_name": "Developer One",
                "future_feature": True,
            }),
            encoding="utf-8",
        )

        profile = self.store.load()

        self.assertEqual(profile.display_name, "Developer One")

    def test_save_rejects_non_profile_object(self):
        with self.assertRaises(TypeError):
            self.store.save({"display_name": "Developer One"})


if __name__ == "__main__":
    unittest.main()
