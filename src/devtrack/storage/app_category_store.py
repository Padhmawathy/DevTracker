
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from devtrack.config.paths import get_data_path

from devtrack.models.app_category import AppCategoryRule


class JSONAppCategoryStore:
    """Store application categories for one local developer."""

    def __init__(self, path=None):
        self.path = (
            Path(path)
            if path is not None
            else get_data_path("app_categories.json")
        )

    def load(self) -> list[AppCategoryRule]:
        """Return saved rules or an empty list."""
        if not self.path.exists():
            return []

        with self.path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        if not isinstance(data, list):
            raise ValueError("Invalid app category file")

        rules = []
        seen_names = set()

        for item in data:
            if not isinstance(item, dict):
                raise ValueError("Invalid application category rule")

            rule = AppCategoryRule(
                app_name=item.get("app_name"),
                category=item.get("category"),
            )

            key = rule.normalized_app_name

            if key in seen_names:
                raise ValueError(
                    "Duplicate application category rule"
                )

            seen_names.add(key)
            rules.append(rule)

        return rules

    def save(self, rules: list[AppCategoryRule]) -> None:
        """Validate and atomically save all category rules."""
        if not isinstance(rules, list):
            raise TypeError("Expected a list of category rules")

        seen_names = set()
        data = []

        for rule in rules:
            if not isinstance(rule, AppCategoryRule):
                raise TypeError("Expected AppCategoryRule")

            # Revalidate in case the rule was changed later.
            validated = AppCategoryRule(
                app_name=rule.app_name,
                category=rule.category,
            )

            key = validated.normalized_app_name

            if key in seen_names:
                raise ValueError(
                    "Duplicate application category rule"
                )

            seen_names.add(key)

            data.append({
                "app_name": validated.app_name,
                "category": validated.category,
            })

        self.path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        temporary_path = None

        try:
            with NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=self.path.parent,
                suffix=".tmp",
                delete=False,
            ) as file:
                temporary_path = Path(file.name)
                json.dump(data, file, indent=2)

            os.replace(temporary_path, self.path)

        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
