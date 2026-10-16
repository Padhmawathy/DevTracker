
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from contextlib import closing, contextmanager

from devtrack.config.paths import get_data_path

class SQLiteCheckInStore:
    def __init__(self, db_path=None):
        self.db_path = (
            Path(db_path)
            if db_path is not None
            else get_data_path("devtrack.db")
        )

        self.db_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        self._create_tables()

    @contextmanager
    def _connect(self):
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.row_factory = sqlite3.Row

            with connection:
                yield connection

    def _create_tables(self):
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS checkins (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_name TEXT NOT NULL,
                    work_description TEXT NOT NULL,
                    category TEXT NOT NULL,
                    blocker TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )

            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                idx_checkins_created_at
                ON checkins(created_at)
                """
            )

    def save(self, checkin):
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO checkins (
                    project_name,
                    work_description,
                    category,
                    blocker,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    checkin.project_name,
                    checkin.work_description,
                    checkin.category,
                    checkin.blocker,
                    checkin.created_at.isoformat(),
                ),
            )
            return cursor.lastrowid

    def get_daily_checkins(self, day):
        start = datetime.combine(
            day, datetime.min.time()
        )
        end = start + timedelta(days=1)

        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM checkins
                WHERE created_at >= ?
                  AND created_at < ?
                ORDER BY created_at ASC
                """,
                (
                    start.isoformat(),
                    end.isoformat(),
                ),
            ).fetchall()

        return [dict(row) for row in rows]
