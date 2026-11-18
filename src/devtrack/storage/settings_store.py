
from importlib.resources import path
import json
from pathlib import Path
from devtrack.config.paths import get_data_path
from devtrack.models.settings import TrackerSettings


class JSONSettingsStore:
    def __init__(self, path=None):
        self.path = (
            Path(path)
            if path is not None
            else get_data_path("settings.json")
        )
    def load(self):
        if not self.path.exists():
            return TrackerSettings()

        with self.path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        return TrackerSettings(**data)

    def save(self, settings: TrackerSettings):
        self.path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        with self.path.open("w", encoding="utf-8") as file:
            json.dump(
                settings.to_dict(),
                file,
                indent=2,
            )
