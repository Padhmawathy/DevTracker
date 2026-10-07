import sqlite3
from datetime import datetime, timedelta
from pathlib import Path


class SQLiteActivityStore:
    def __init__(self, db_path="data/devtrack.db"):
        self.db_path = Path(db_path)

        self.db_path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        self._create_tables()

    def _connect(self):
        connection = sqlite3.connect(
            self.db_path
        )

        connection.row_factory = sqlite3.Row

        return connection

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

            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                idx_activities_started_at
                ON activities(started_at)
                """
            )

            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS
                idx_activities_process_name
                ON activities(process_name)
                """
            )

    def save(self, activity):
        with self._connect() as connection:
            cursor = connection.execute(
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

            return cursor.lastrowid

    def get_recent(self, limit=20):
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM activities
                ORDER BY started_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        return [
            dict(row)
            for row in rows
        ]

    def get_between(
        self,
        start_time: datetime,
        end_time: datetime,
    ):
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM activities
                WHERE ended_at > ?
                  AND started_at < ?
                ORDER BY started_at ASC
                """,
                (
                    start_time.isoformat(),
                    end_time.isoformat(),
                ),
            ).fetchall()

        return [
            dict(row)
            for row in rows
        ]

    def get_by_process(
        self,
        process_name: str,
        limit=100,
    ):
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM activities
                WHERE LOWER(process_name) = LOWER(?)
                ORDER BY started_at DESC
                LIMIT ?
                """,
                (
                    process_name,
                    limit,
                ),
            ).fetchall()

        return [
            dict(row)
            for row in rows
        ]

    def get_usage_summary(
        self,
        start_time: datetime,
        end_time: datetime,
    ):
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT
                    process_name,
                    SUM(duration_seconds) AS total_seconds,
                    COUNT(*) AS activity_count
                FROM activities
                WHERE started_at >= ?
                AND started_at < ?
                GROUP BY process_name
                ORDER BY total_seconds DESC
                """,
                (
                    start_time.isoformat(),
                    end_time.isoformat(),
                ),
            ).fetchall()

        return [
            dict(row)
            for row in rows
        ]
    def get_daily_application_usage(self, day):
        start_time = datetime.combine(
            day,
            datetime.min.time(),
        )

        end_time = start_time + timedelta(days=1)

        return self.get_usage_summary(
            start_time,
            end_time,
        )
    def get_daily_timeline(self, day):
        start_time = datetime.combine(
            day,
            datetime.min.time(),
        )

        end_time = start_time + timedelta(days=1)

        return self.get_between(
            start_time,
            end_time,
        )   

    def get_daily_summary(self, day):
        activities = self.get_daily_timeline(day)

        if not activities:
            return {
                "date": day.isoformat(),
                "total_seconds": 0,
                "activity_count": 0,
                "application_count": 0,
            }

        applications = {
            activity["process_name"]
            for activity in activities
        }

        total_seconds = sum(
            activity["duration_seconds"]
            for activity in activities
        )

        return {
            "date": day.isoformat(),
            "total_seconds": total_seconds,
            "activity_count": len(activities),
            "application_count": len(applications),
        }