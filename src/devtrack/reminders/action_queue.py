
import re
import sqlite3
import time
from contextlib import closing
from pathlib import Path


class ReminderActionQueue:
    """Pass local notification actions to the collector."""

    VALID_ACTIONS = {"snooze", "skip"}

    def __init__(self, path="data/reminder_actions.db"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

        with closing(self._connect()) as connection:
            with connection:
                connection.execute("""
                    CREATE TABLE IF NOT EXISTS reminder_actions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        action TEXT NOT NULL,
                        created_at REAL NOT NULL,
                        reminder_id TEXT
                    )
                """)

                # Upgrade databases created before reminder IDs.
                columns = {
                    row[1]
                    for row in connection.execute(
                        "PRAGMA table_info(reminder_actions)"
                    )
                }

                if "reminder_id" not in columns:
                    connection.execute(
                        "ALTER TABLE reminder_actions "
                        "ADD COLUMN reminder_id TEXT"
                    )

    def _connect(self):
        return sqlite3.connect(str(self.path), timeout=5)

    @staticmethod
    def _validate_reminder_id(reminder_id):
        if (
            not isinstance(reminder_id, str)
            or re.fullmatch(r"[0-9a-f]{32}", reminder_id) is None
        ):
            raise ValueError("Invalid reminder ID")

    def enqueue(self, action: str, reminder_id=None):
        """Add an action, optionally tied to a reminder."""
        if action not in self.VALID_ACTIONS:
            raise ValueError("Unsupported reminder action")

        if reminder_id is not None:
            self._validate_reminder_id(reminder_id)

        with closing(self._connect()) as connection:
            with connection:
                connection.execute(
                    """
                    INSERT INTO reminder_actions
                        (action, created_at, reminder_id)
                    VALUES (?, ?, ?)
                    """,
                    (action, time.time(), reminder_id),
                )

    def consume(self):
        """Legacy queue reader used by existing collector tests."""
        with closing(self._connect()) as connection:
            with connection:
                connection.execute("BEGIN IMMEDIATE")

                connection.execute(
                    "DELETE FROM reminder_actions WHERE created_at < ?",
                    (time.time() - 600,),
                )

                row = connection.execute(
                    """
                    SELECT id, action
                    FROM reminder_actions
                    ORDER BY id LIMIT 1
                    """
                ).fetchone()

                if row is None:
                    return None

                connection.execute(
                    "DELETE FROM reminder_actions WHERE id = ?",
                    (row[0],),
                )

                return row[1]

    def consume_for_reminder(self, reminder_id: str):
        """Accept actions only for the current reminder."""
        self._validate_reminder_id(reminder_id)

        with closing(self._connect()) as connection:
            with connection:
                connection.execute("BEGIN IMMEDIATE")

                # Remove expired and mismatched actions.
                # Legacy actions without an ID are also rejected.
                connection.execute(
                    """
                    DELETE FROM reminder_actions
                    WHERE created_at < ?
                       OR reminder_id IS NULL
                       OR reminder_id != ?
                    """,
                    (time.time() - 600, reminder_id),
                )

                row = connection.execute(
                    """
                    SELECT id, action
                    FROM reminder_actions
                    WHERE reminder_id = ?
                    ORDER BY id LIMIT 1
                    """,
                    (reminder_id,),
                ).fetchone()

                if row is None:
                    return None

                connection.execute(
                    "DELETE FROM reminder_actions WHERE id = ?",
                    (row[0],),
                )

                return row[1]
