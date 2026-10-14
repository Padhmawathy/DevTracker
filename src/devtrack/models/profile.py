
from dataclasses import asdict, dataclass


VALID_ROLES = {
    "frontend",
    "backend",
    "fullstack",
    "mobile",
    "devops",
    "qa",
    "data",
    "other",
}


@dataclass
class DeveloperProfile:
    """Personal preferences for one local DevTracker user."""

    display_name: str = ""
    role: str = "fullstack"
    primary_language: str = ""
    primary_editor: str = ""
    daily_focus_goal_minutes: int = 240

    def __post_init__(self):
        if not isinstance(self.display_name, str):
            raise ValueError("Display name must be text")

        self.display_name = self.display_name.strip()

        if len(self.display_name) > 80:
            raise ValueError("Display name is too long")

        if self.role not in VALID_ROLES:
            raise ValueError("Unsupported developer role")

        if not isinstance(self.primary_language, str):
            raise ValueError("Primary language must be text")

        self.primary_language = self.primary_language.strip()

        if len(self.primary_language) > 80:
            raise ValueError("Primary language is too long")

        if not isinstance(self.primary_editor, str):
            raise ValueError("Primary editor must be text")

        self.primary_editor = self.primary_editor.strip()

        if len(self.primary_editor) > 80:
            raise ValueError("Primary editor is too long")

        if (
            type(self.daily_focus_goal_minutes) is not int
            or not 30 <= self.daily_focus_goal_minutes <= 720
        ):
            raise ValueError(
                "Daily focus goal must be between 30 and 720 minutes"
            )

    def to_dict(self):
        return asdict(self)
