
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from devtrack.models.app_category import AppCategoryRule
from devtrack.storage.app_category_store import JSONAppCategoryStore


class TestAppCategoryStore(unittest.TestCase):

    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)

        self.path = Path(self.folder.name) / "categories.json"
        self.store = JSONAppCategoryStore(self.path)

    def test_missing_file_returns_empty_list(self):
        self.assertEqual(self.store.load(), [])
        self.assertFalse(self.path.exists())

    def test_save_and_load_rules(self):
        rules = [
            AppCategoryRule("VS Code", "development"),
            AppCategoryRule("Postman", "testing"),
        ]

        self.store.save(rules)

        restored = self.store.load()

        self.assertEqual(restored, rules)

    def test_saved_rules_are_valid_json(self):
        self.store.save([
            AppCategoryRule("Figma", "design")
        ])

        data = json.loads(
            self.path.read_text(encoding="utf-8")
        )

        self.assertEqual(data, [
            {"app_name": "Figma", "category": "design"}
        ])

    def test_invalid_json_structure_rejected(self):
        self.path.write_text(
            json.dumps({"app_name": "VS Code"}),
            encoding="utf-8",
        )

        with self.assertRaises(ValueError):
            self.store.load()

    def test_invalid_rule_rejected(self):
        self.path.write_text(
            json.dumps([
                {"app_name": "", "category": "development"}
            ]),
            encoding="utf-8",
        )

        with self.assertRaises(ValueError):
            self.store.load()

    def test_duplicate_names_rejected_on_save(self):
        rules = [
            AppCategoryRule("VS Code", "development"),
            AppCategoryRule("vs code", "testing"),
        ]

        with self.assertRaises(ValueError):
            self.store.save(rules)

    def test_duplicate_names_rejected_on_load(self):
        self.path.write_text(
            json.dumps([
                {"app_name": "Postman", "category": "testing"},
                {"app_name": "postman", "category": "research"},
            ]),
            encoding="utf-8",
        )

        with self.assertRaises(ValueError):
            self.store.load()

    def test_invalid_save_type_rejected(self):
        with self.assertRaises(TypeError):
            self.store.save("not a list")

    def test_empty_list_can_be_saved(self):
        self.store.save([])

        self.assertEqual(self.store.load(), [])
        self.assertTrue(self.path.exists())


if __name__ == "__main__":
    unittest.main()
