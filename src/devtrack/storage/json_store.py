import json
from pathlib import Path


class JsonActivityStore:
    def __init__(self, file_path="data/activity.jsonl"):
        self.file_path = Path(file_path)
        self.file_path.parent.mkdir(parents=True, exist_ok=True)

    def save(self, activity):
        with self.file_path.open("a", encoding="utf-8") as file:
            json.dump(activity.to_dict(), file, ensure_ascii=False)
            file.write("\n")