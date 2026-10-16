
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from devtrack.config.paths import get_data_path
from devtrack.models.profile import DeveloperProfile


class JSONDeveloperProfileStore:
    """Store one developer's profile locally."""

    def __init__(self, path=None):
        self.path = (
            Path(path)
            if path is not None
            else get_data_path("developer_profile.json")
        )

    def load(self) -> DeveloperProfile:
        """Load a profile or create the default profile."""
        if not self.path.exists():
            return DeveloperProfile()

        with self.path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        if not isinstance(data, dict):
            raise ValueError("Invalid developer profile file")

        # Ignore unknown fields for forward compatibility,
        # but reject malformed values for known fields.
        allowed_fields = DeveloperProfile.__dataclass_fields__
        profile_data = {
            key: value
            for key, value in data.items()
            if key in allowed_fields
        }

        return DeveloperProfile(**profile_data)

    def save(self, profile: DeveloperProfile) -> None:
        """Atomically save the developer profile."""
        if not isinstance(profile, DeveloperProfile):
            raise TypeError("Expected DeveloperProfile")

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
                json.dump(
                    profile.to_dict(),
                    file,
                    indent=2,
                )

            os.replace(temporary_path, self.path)

        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)
