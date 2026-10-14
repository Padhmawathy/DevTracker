
from dataclasses import dataclass


VALID_APP_CATEGORIES = {
    "development",
    "research",
    "testing",
    "design",
    "communication",
    "meetings",
    "personal",
    "other",
}


@dataclass
class AppCategoryRule:
    """A developer's classification for one application."""

    app_name: str
    category: str

    def __post_init__(self):
        if not isinstance(self.app_name, str):
            raise ValueError("Application name must be text")

        self.app_name = self.app_name.strip()

        if not self.app_name or len(self.app_name) > 120:
            raise ValueError(
                "Application name must contain 1–120 characters"
            )

        if not isinstance(self.category, str):
            raise ValueError("Category must be text")

        self.category = self.category.strip().lower()

        if self.category not in VALID_APP_CATEGORIES:
            raise ValueError("Unsupported application category")

    @property
    def normalized_app_name(self) -> str:
        """Stable key for matching application names."""
        return self.app_name.casefold()
