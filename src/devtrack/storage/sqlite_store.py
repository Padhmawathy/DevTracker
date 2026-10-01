import sqlite3
from pathlib import Path


class SQLiteActivityStore:
    def __init__(self, db_path="data/devtrack.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self._create_tables()

    def _connect(self):
        return sqlite3.connect(self.db_path)

    def _create_tables(self):
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS activities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    process_name TEXT NOT NULL,
                    process_id INTEGER,
                    window_title TEXT,
                    started_at TEXT NOT NULL,
                    ended_at TEXT NOT NULL,
                    duration_seconds REAL NOT NULL
                )
                """
            )

    def save(self, activity):
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO activities (
                    process_name,
                    process_id,
                    window_title,
                    started_at,
                    ended_at,
                    duration_seconds
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    activity.process_name,
                    activity.process_id,
                    activity.window_title,
                    activity.started_at.isoformat(),
                    activity.ended_at.isoformat(),
                    activity.duration_seconds,
                ),
            )