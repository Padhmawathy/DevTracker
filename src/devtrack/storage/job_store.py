import re
import sqlite3
from contextlib import closing, contextmanager
from datetime import date, datetime
from pathlib import Path

from devtrack.config.paths import get_data_path

JOB_STATUSES = ("active", "archived")
ENTRY_STATUSES = ("planned", "done")
PLATFORMS = ("linkedin", "instagram", "reddit", "x", "other")
COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")
# An emoji (incl. ZWJ sequences / skin tones); no letters, digits or spaces.
MAX_EMOJI_LENGTH = 16
EMOJI_FORBIDDEN = re.compile(r"[\sA-Za-z0-9<>&\"']")


class JobNotFoundError(LookupError):
    pass


class WorkEntryNotFoundError(LookupError):
    pass


class DuplicateJobError(ValueError):
    pass


class SQLiteJobStore:
    """Stores jobs and the per-day work entries logged against them."""

    def __init__(self, db_path=None):
        self.db_path = (
            Path(db_path)
            if db_path is not None
            else get_data_path("devtrack.db")
        )
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._create_tables()

    @contextmanager
    def _connect(self):
        with closing(sqlite3.connect(self.db_path)) as connection:
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            with connection:
                yield connection

    def _create_tables(self):
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    client TEXT,
                    color TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS work_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    job_id INTEGER NOT NULL
                        REFERENCES jobs(id) ON DELETE CASCADE,
                    entry_date TEXT NOT NULL,
                    hours REAL,
                    description TEXT NOT NULL,
                    platform TEXT,
                    link TEXT,
                    status TEXT NOT NULL DEFAULT 'done',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_work_entries_date
                ON work_entries(entry_date)
                """
            )
            # v0.1.8: optional emoji shown instead of the colour dot.
            columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(jobs)")
            }
            if "emoji" not in columns:
                connection.execute("ALTER TABLE jobs ADD COLUMN emoji TEXT")

    # ---------------- validation ----------------

    @staticmethod
    def _validate_job(name, color, status, emoji=None):
        if not name or not name.strip():
            raise ValueError("Job name is required.")
        if emoji is not None and (
            not emoji.strip()
            or len(emoji) > MAX_EMOJI_LENGTH
            or EMOJI_FORBIDDEN.search(emoji)
        ):
            raise ValueError("Emoji must be a single emoji.")
        if not COLOR_PATTERN.match(color or ""):
            raise ValueError("Color must be a hex value like #4f9d7a.")
        if status not in JOB_STATUSES:
            raise ValueError("Job status must be active or archived.")

    @staticmethod
    def _validate_entry(entry_date, hours, description, status, platform, link):
        if not isinstance(entry_date, date):
            raise ValueError("Entry date is required.")
        if hours is not None and not 0 < hours <= 24:
            raise ValueError("Hours must be greater than 0 and at most 24.")
        if platform is not None and platform not in PLATFORMS:
            raise ValueError("Unknown platform.")
        if link and not link.strip().lower().startswith(("http://", "https://")):
            raise ValueError("Link must start with http:// or https://.")
        if not description or not description.strip():
            raise ValueError("Description is required.")
        if status not in ENTRY_STATUSES:
            raise ValueError("Entry status must be planned or done.")

    # ---------------- jobs ----------------

    def list_jobs(self, include_archived=True):
        query = """
            SELECT
                jobs.*,
                COALESCE(SUM(CASE WHEN work_entries.status = 'done'
                    THEN work_entries.hours END), 0) AS done_hours,
                COALESCE(SUM(CASE WHEN work_entries.status = 'planned'
                    THEN work_entries.hours END), 0) AS planned_hours,
                COUNT(work_entries.id) AS entry_count,
                COUNT(work_entries.platform) AS post_count,
                MAX(work_entries.entry_date) AS last_entry_date
            FROM jobs
            LEFT JOIN work_entries ON work_entries.job_id = jobs.id
        """
        if not include_archived:
            query += " WHERE jobs.status = 'active'"
        query += " GROUP BY jobs.id ORDER BY jobs.status, jobs.name"

        with self._connect() as connection:
            rows = connection.execute(query).fetchall()
        return [self._job_row(row) for row in rows]

    def get_job(self, job_id):
        for job in self.list_jobs():
            if job["id"] == job_id:
                return job
        raise JobNotFoundError(job_id)

    def create_job(self, name, color, client=None, status="active", emoji=None):
        emoji = (emoji or "").strip() or None
        self._validate_job(name, color, status, emoji)
        try:
            with self._connect() as connection:
                cursor = connection.execute(
                    """
                    INSERT INTO jobs (name, client, color, emoji, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        name.strip(),
                        (client or "").strip() or None,
                        color.lower(),
                        emoji,
                        status,
                        datetime.now().isoformat(),
                    ),
                )
        except sqlite3.IntegrityError as exc:
            raise DuplicateJobError(
                "A job with this name already exists."
            ) from exc
        return self.get_job(cursor.lastrowid)

    def update_job(
        self, job_id, name, color, client=None, status="active", emoji=None
    ):
        emoji = (emoji or "").strip() or None
        self._validate_job(name, color, status, emoji)
        try:
            with self._connect() as connection:
                cursor = connection.execute(
                    """
                    UPDATE jobs
                    SET name = ?, client = ?, color = ?, emoji = ?, status = ?
                    WHERE id = ?
                    """,
                    (
                        name.strip(),
                        (client or "").strip() or None,
                        color.lower(),
                        emoji,
                        status,
                        job_id,
                    ),
                )
        except sqlite3.IntegrityError as exc:
            raise DuplicateJobError(
                "A job with this name already exists."
            ) from exc
        if cursor.rowcount == 0:
            raise JobNotFoundError(job_id)
        return self.get_job(job_id)

    # ---------------- work entries ----------------

    def list_entries(self, start, end, job_id=None):
        query = """
            SELECT work_entries.*, jobs.name AS job_name, jobs.color AS job_color,
                   jobs.emoji AS job_emoji
            FROM work_entries
            JOIN jobs ON jobs.id = work_entries.job_id
            WHERE work_entries.entry_date >= ? AND work_entries.entry_date <= ?
        """
        params = [start.isoformat(), end.isoformat()]
        if job_id is not None:
            query += " AND work_entries.job_id = ?"
            params.append(job_id)
        query += " ORDER BY work_entries.entry_date, work_entries.id"

        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()
        return [self._entry_row(row) for row in rows]

    def get_entry(self, entry_id):
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT work_entries.*, jobs.name AS job_name,
                       jobs.color AS job_color, jobs.emoji AS job_emoji
                FROM work_entries
                JOIN jobs ON jobs.id = work_entries.job_id
                WHERE work_entries.id = ?
                """,
                (entry_id,),
            ).fetchone()
        if row is None:
            raise WorkEntryNotFoundError(entry_id)
        return self._entry_row(row)

    def _ensure_job_exists(self, connection, job_id):
        row = connection.execute(
            "SELECT 1 FROM jobs WHERE id = ?", (job_id,)
        ).fetchone()
        if row is None:
            raise JobNotFoundError(job_id)

    def create_entry(
        self, job_id, entry_date, description, hours=None, status="done",
        platform=None, link=None,
    ):
        self._validate_entry(
            entry_date, hours, description, status, platform, link
        )
        now = datetime.now().isoformat()
        with self._connect() as connection:
            self._ensure_job_exists(connection, job_id)
            cursor = connection.execute(
                """
                INSERT INTO work_entries (
                    job_id, entry_date, hours, description, status,
                    platform, link, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job_id,
                    entry_date.isoformat(),
                    None if hours is None else round(float(hours), 2),
                    description.strip(),
                    status,
                    platform,
                    (link or "").strip() or None,
                    now,
                    now,
                ),
            )
        return self.get_entry(cursor.lastrowid)

    def update_entry(
        self, entry_id, job_id, entry_date, description, hours=None,
        status="done", platform=None, link=None,
    ):
        self._validate_entry(
            entry_date, hours, description, status, platform, link
        )
        with self._connect() as connection:
            self._ensure_job_exists(connection, job_id)
            cursor = connection.execute(
                """
                UPDATE work_entries
                SET job_id = ?, entry_date = ?, hours = ?, description = ?,
                    status = ?, platform = ?, link = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    job_id,
                    entry_date.isoformat(),
                    None if hours is None else round(float(hours), 2),
                    description.strip(),
                    status,
                    platform,
                    (link or "").strip() or None,
                    datetime.now().isoformat(),
                    entry_id,
                ),
            )
        if cursor.rowcount == 0:
            raise WorkEntryNotFoundError(entry_id)
        return self.get_entry(entry_id)

    def delete_entry(self, entry_id):
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM work_entries WHERE id = ?", (entry_id,)
            )
        if cursor.rowcount == 0:
            raise WorkEntryNotFoundError(entry_id)

    # ---------------- row mapping ----------------

    @staticmethod
    def _job_row(row):
        return {
            "id": row["id"],
            "name": row["name"],
            "client": row["client"],
            "color": row["color"],
            "emoji": row["emoji"],
            "status": row["status"],
            "created_at": row["created_at"],
            "done_hours": round(row["done_hours"], 2),
            "planned_hours": round(row["planned_hours"], 2),
            "entry_count": row["entry_count"],
            "post_count": row["post_count"],
            "last_entry_date": row["last_entry_date"],
        }

    @staticmethod
    def _entry_row(row):
        return {
            "id": row["id"],
            "job_id": row["job_id"],
            "job_name": row["job_name"],
            "job_color": row["job_color"],
            "job_emoji": row["job_emoji"],
            "entry_date": row["entry_date"],
            "hours": row["hours"],
            "description": row["description"],
            "status": row["status"],
            "platform": row["platform"],
            "link": row["link"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
