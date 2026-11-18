import sqlite3
from contextlib import closing, contextmanager
from datetime import date, datetime
from pathlib import Path

from devtrack.config.paths import get_data_path
from devtrack.storage.job_store import JobNotFoundError, SQLiteJobStore

TASK_STATUSES = ("todo", "in_progress", "done")
TASK_PRIORITIES = ("none", "low", "medium", "high")
MAX_TITLE_LENGTH = 200
MAX_NOTES_LENGTH = 4000


class TaskNotFoundError(LookupError):
    pass


class SQLiteTaskStore:
    """Stores tasks, optionally linked to a job from the job calendar."""

    def __init__(self, db_path=None):
        self.db_path = (
            Path(db_path)
            if db_path is not None
            else get_data_path("devtrack.db")
        )
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        # Tasks reference jobs, so make sure the jobs table exists first.
        SQLiteJobStore(self.db_path)
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
                CREATE TABLE IF NOT EXISTS tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    notes TEXT,
                    due_date TEXT,
                    priority TEXT NOT NULL DEFAULT 'none',
                    status TEXT NOT NULL DEFAULT 'todo',
                    job_id INTEGER
                        REFERENCES jobs(id) ON DELETE SET NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_at TEXT
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_tasks_status_due
                ON tasks(status, due_date)
                """
            )

    # ---------------- validation ----------------

    @staticmethod
    def _validate(title, notes, due_date, priority, status):
        if not title or not title.strip():
            raise ValueError("Task title is required.")
        if len(title.strip()) > MAX_TITLE_LENGTH:
            raise ValueError("Task title is too long.")
        if notes and len(notes) > MAX_NOTES_LENGTH:
            raise ValueError("Task notes are too long.")
        if due_date is not None and not isinstance(due_date, date):
            raise ValueError("Due date must be a date.")
        if priority not in TASK_PRIORITIES:
            raise ValueError("Priority must be none, low, medium or high.")
        if status not in TASK_STATUSES:
            raise ValueError("Status must be todo, in_progress or done.")

    @staticmethod
    def _ensure_job(connection, job_id):
        if job_id is None:
            return
        row = connection.execute(
            "SELECT 1 FROM jobs WHERE id = ?", (job_id,)
        ).fetchone()
        if row is None:
            raise JobNotFoundError(job_id)

    # ---------------- queries ----------------

    _SELECT = """
        SELECT tasks.*, jobs.name AS job_name, jobs.color AS job_color
        FROM tasks
        LEFT JOIN jobs ON jobs.id = tasks.job_id
    """

    def list_tasks(self):
        # Open tasks first; within them, dated tasks by due date, then
        # higher priority; completed tasks newest first.
        query = self._SELECT + """
            ORDER BY
                CASE tasks.status WHEN 'done' THEN 1 ELSE 0 END,
                CASE WHEN tasks.status = 'done' THEN tasks.completed_at END DESC,
                CASE WHEN tasks.due_date IS NULL THEN 1 ELSE 0 END,
                tasks.due_date,
                CASE tasks.priority
                    WHEN 'high' THEN 0 WHEN 'medium' THEN 1
                    WHEN 'low' THEN 2 ELSE 3 END,
                tasks.id
        """
        with self._connect() as connection:
            rows = connection.execute(query).fetchall()
        return [self._row(row) for row in rows]

    def get_task(self, task_id):
        with self._connect() as connection:
            row = connection.execute(
                self._SELECT + " WHERE tasks.id = ?", (task_id,)
            ).fetchone()
        if row is None:
            raise TaskNotFoundError(task_id)
        return self._row(row)

    # ---------------- writes ----------------

    def create_task(
        self, title, notes=None, due_date=None, priority="none",
        status="todo", job_id=None,
    ):
        self._validate(title, notes, due_date, priority, status)
        now = datetime.now().isoformat()
        with self._connect() as connection:
            self._ensure_job(connection, job_id)
            cursor = connection.execute(
                """
                INSERT INTO tasks (
                    title, notes, due_date, priority, status, job_id,
                    created_at, updated_at, completed_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    title.strip(),
                    (notes or "").strip() or None,
                    due_date.isoformat() if due_date else None,
                    priority,
                    status,
                    job_id,
                    now,
                    now,
                    now if status == "done" else None,
                ),
            )
        return self.get_task(cursor.lastrowid)

    def update_task(
        self, task_id, title, notes=None, due_date=None, priority="none",
        status="todo", job_id=None,
    ):
        self._validate(title, notes, due_date, priority, status)
        now = datetime.now().isoformat()
        with self._connect() as connection:
            self._ensure_job(connection, job_id)
            existing = connection.execute(
                "SELECT status, completed_at FROM tasks WHERE id = ?",
                (task_id,),
            ).fetchone()
            if existing is None:
                raise TaskNotFoundError(task_id)

            # Keep the original completion time when a done task is edited.
            if status != "done":
                completed_at = None
            elif existing["status"] == "done":
                completed_at = existing["completed_at"] or now
            else:
                completed_at = now

            connection.execute(
                """
                UPDATE tasks
                SET title = ?, notes = ?, due_date = ?, priority = ?,
                    status = ?, job_id = ?, updated_at = ?, completed_at = ?
                WHERE id = ?
                """,
                (
                    title.strip(),
                    (notes or "").strip() or None,
                    due_date.isoformat() if due_date else None,
                    priority,
                    status,
                    job_id,
                    now,
                    completed_at,
                    task_id,
                ),
            )
        return self.get_task(task_id)

    def delete_task(self, task_id):
        with self._connect() as connection:
            cursor = connection.execute(
                "DELETE FROM tasks WHERE id = ?", (task_id,)
            )
        if cursor.rowcount == 0:
            raise TaskNotFoundError(task_id)

    @staticmethod
    def _row(row):
        return {
            "id": row["id"],
            "title": row["title"],
            "notes": row["notes"],
            "due_date": row["due_date"],
            "priority": row["priority"],
            "status": row["status"],
            "job_id": row["job_id"],
            "job_name": row["job_name"],
            "job_color": row["job_color"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "completed_at": row["completed_at"],
        }
