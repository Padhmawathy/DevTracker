
import unittest

from devtrack.models.app_category import (
    AppCategoryRule,
    VALID_APP_CATEGORIES,
)


class TestAppCategoryRule(unittest.TestCase):

    def test_valid_development_rule(self):
        rule = AppCategoryRule(
            app_name="Visual Studio Code",
            category="development",
        )

        self.assertEqual(rule.app_name, "Visual Studio Code")
        self.assertEqual(rule.category, "development")

    def test_name_and_category_trimmed(self):
        rule = AppCategoryRule(
            app_name="  Postman  ",
            category="  TESTING  ",
        )

        self.assertEqual(rule.app_name, "Postman")
        self.assertEqual(rule.category, "testing")

    def test_case_insensitive_app_key(self):
        first = AppCategoryRule("VS Code", "development")
        second = AppCategoryRule("vs code", "testing")

        self.assertEqual(
            first.normalized_app_name,
            second.normalized_app_name,
        )

    def test_empty_app_name_rejected(self):
        with self.assertRaises(ValueError):
            AppCategoryRule("   ", "development")

    def test_long_app_name_rejected(self):
        with self.assertRaises(ValueError):
            AppCategoryRule("A" * 121, "development")

    def test_invalid_category_rejected(self):
        with self.assertRaises(ValueError):
            AppCategoryRule("Postman", "unknown")

    def test_non_string_name_rejected(self):
        with self.assertRaises(ValueError):
            AppCategoryRule(123, "development")

    def test_non_string_category_rejected(self):
        with self.assertRaises(ValueError):
            AppCategoryRule("Postman", 123)

    def test_all_supported_categories(self):
        for category in VALID_APP_CATEGORIES:
            with self.subTest(category=category):
                rule = AppCategoryRule("Example App", category)
                self.assertEqual(rule.category, category)


if __name__ == "__main__":
    unittest.main()
