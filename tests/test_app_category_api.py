
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi.testclient import TestClient

from devtrack.api.main import app
from devtrack.storage.app_category_store import JSONAppCategoryStore


class TestAppCategoryAPI(unittest.TestCase):

    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)

        self.path = Path(self.folder.name) / "categories.json"

        self.store_patch = patch(
            "devtrack.api.main.JSONAppCategoryStore",
            return_value=JSONAppCategoryStore(self.path),
        )
        self.store_patch.start()
        self.addCleanup(self.store_patch.stop)

        self.client = TestClient(app)

    def test_get_default_categories(self):
        response = self.client.get("/api/app-categories")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"rules": []})

    def test_save_categories(self):
        response = self.client.put(
            "/api/app-categories",
            json={
                "rules": [
                    {
                        "app_name": "VS Code",
                        "category": "development",
                    },
                    {
                        "app_name": "Postman",
                        "category": "testing",
                    },
                ]
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["rules"]), 2)

        saved = JSONAppCategoryStore(self.path).load()
        self.assertEqual(len(saved), 2)

    def test_get_saved_categories(self):
        self.client.put(
            "/api/app-categories",
            json={
                "rules": [
                    {
                        "app_name": "Figma",
                        "category": "design",
                    }
                ]
            },
        )

        response = self.client.get("/api/app-categories")

        self.assertEqual(
            response.json()["rules"][0]["app_name"],
            "Figma",
        )

    def test_invalid_category_rejected(self):
        response = self.client.put(
            "/api/app-categories",
            json={
                "rules": [
                    {
                        "app_name": "VS Code",
                        "category": "invalid",
                    }
                ]
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertFalse(self.path.exists())

    def test_duplicate_app_names_rejected(self):
        response = self.client.put(
            "/api/app-categories",
            json={
                "rules": [
                    {
                        "app_name": "VS Code",
                        "category": "development",
                    },
                    {
                        "app_name": "vs code",
                        "category": "testing",
                    },
                ]
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertFalse(self.path.exists())

    def test_empty_list_removes_categories(self):
        self.client.put(
            "/api/app-categories",
            json={
                "rules": [
                    {
                        "app_name": "Postman",
                        "category": "testing",
                    }
                ]
            },
        )

        response = self.client.put(
            "/api/app-categories",
            json={"rules": []},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["rules"], [])
        self.assertEqual(
            JSONAppCategoryStore(self.path).load(),
            [],
        )


if __name__ == "__main__":
    unittest.main()
