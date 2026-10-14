
import unittest

from devtrack.models.profile import DeveloperProfile


class TestDeveloperProfile(unittest.TestCase):

    def test_default_profile(self):
        profile = DeveloperProfile()

        self.assertEqual(profile.display_name, "")
        self.assertEqual(profile.role, "fullstack")
        self.assertEqual(
            profile.daily_focus_goal_minutes,
            240,
        )

    def test_custom_profile(self):
        profile = DeveloperProfile(
            display_name="Developer One",
            role="backend",
            primary_language="Python",
            primary_editor="VS Code",
            daily_focus_goal_minutes=300,
        )

        self.assertEqual(profile.role, "backend")
        self.assertEqual(profile.primary_language, "Python")
        self.assertEqual(profile.daily_focus_goal_minutes, 300)

    def test_whitespace_trimmed(self):
        profile = DeveloperProfile(
            display_name="  Developer One  ",
            primary_language="  TypeScript  ",
        )

        self.assertEqual(profile.display_name, "Developer One")
        self.assertEqual(profile.primary_language, "TypeScript")

    def test_invalid_role_rejected(self):
        with self.assertRaises(ValueError):
            DeveloperProfile(role="unknown-role")

    def test_invalid_focus_goal_rejected(self):
        for value in [0, 20, 721, -30, True, "240"]:
            with self.subTest(value=value):
                with self.assertRaises(ValueError):
                    DeveloperProfile(
                        daily_focus_goal_minutes=value
                    )

    def test_invalid_name_rejected(self):
        with self.assertRaises(ValueError):
            DeveloperProfile(display_name="A" * 81)

    def test_profile_serialization(self):
        profile = DeveloperProfile(
            display_name="Developer One",
            role="frontend",
            primary_language="TypeScript",
        )

        data = profile.to_dict()

        self.assertEqual(data["display_name"], "Developer One")
        self.assertEqual(data["role"], "frontend")
        self.assertEqual(data["primary_language"], "TypeScript")
        self.assertIn("daily_focus_goal_minutes", data)


if __name__ == "__main__":
    unittest.main()
