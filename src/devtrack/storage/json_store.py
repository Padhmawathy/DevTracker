
import json
from pathlib import Path

from devtrack.config.paths import get_data_path


class JsonActivityStore:
    def __init__(self, file_path=None):
        self.file_path = (
            Path(file_path)
            if file_path is not None
            else get_data_path("activity.jsonl")
        )

        self.file_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

    def save(self, activity):
        with self.file_path.open("a", encoding="utf-8") as file:
            json.dump(
                activity.to_dict(),
                file,
                ensure_ascii=False,
            )
            file.write("\n")
