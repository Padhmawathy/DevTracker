
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi.testclient import TestClient

from devtrack.api.main import app
from devtrack.storage.profile_store import JSONDeveloperProfileStore


class TestDeveloperProfileAPI(unittest.TestCase):

    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)

        self.path = Path(self.folder.name) / "profile.json"

        self.store_patch = patch(
            "devtrack.api.main.JSONDeveloperProfileStore",
            return_value=JSONDeveloperProfileStore(self.path),
        )
        self.store_patch.start()
        self.addCleanup(self.store_patch.stop)

        self.client = TestClient(app)

    def test_get_default_profile(self):
        response = self.client.get("/api/profile")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["role"],
            "fullstack",
        )
        self.assertFalse(self.path.exists())

    def test_update_profile(self):
        response = self.client.put(
            "/api/profile",
            json={
                "display_name": "Developer One",
                "role": "backend",
                "primary_language": "Python",
                "primary_editor": "VS Code",
                "daily_focus_goal_minutes": 300,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["display_name"],
            "Developer One",
        )

        restored = JSONDeveloperProfileStore(self.path).load()
        self.assertEqual(restored.role, "backend")
        self.assertEqual(
            restored.daily_focus_goal_minutes,
            300,
        )

    def test_invalid_role_returns_422(self):
        response = self.client.put(
            "/api/profile",
            json={"role": "invalid-role"},
        )

        self.assertEqual(response.status_code, 422)
        self.assertFalse(self.path.exists())

    def test_invalid_focus_goal_returns_422(self):
        response = self.client.put(
            "/api/profile",
            json={"daily_focus_goal_minutes": 1000},
        )

        self.assertEqual(response.status_code, 422)
        self.assertFalse(self.path.exists())

    def test_boolean_focus_goal_rejected(self):
        response = self.client.put(
            "/api/profile",
            json={"daily_focus_goal_minutes": True},
        )

        self.assertEqual(response.status_code, 422)

    def test_get_saved_profile(self):
        self.client.put(
            "/api/profile",
            json={
                "display_name": "Developer One",
                "role": "frontend",
            },
        )

        response = self.client.get("/api/profile")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["display_name"],
            "Developer One",
        )
        self.assertEqual(
            response.json()["role"],
            "frontend",
        )


if __name__ == "__main__":
    unittest.main()
