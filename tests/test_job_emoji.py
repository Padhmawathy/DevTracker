import sqlite3
from contextlib import closing
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from devtrack.api.main import app
from devtrack.storage.job_store import SQLiteJobStore
from devtrack.storage.task_store import SQLiteTaskStore


class TestJobEmoji(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "jobs.db"

    def tearDown(self):
        self.tmp.cleanup()

    def test_create_update_and_clear_emoji(self):
        store = SQLiteJobStore(self.db)
        job = store.create_job("Acme", "#0a84ff", emoji="🐱")
        self.assertEqual(job["emoji"], "🐱")

        # ZWJ sequence with skin tone stays intact.
        job = store.update_job(job["id"], "Acme", "#0a84ff", emoji="👩🏽‍💻")
        self.assertEqual(job["emoji"], "👩🏽‍💻")

        job = store.update_job(job["id"], "Acme", "#0a84ff", emoji="")
        self.assertIsNone(job["emoji"])

    def test_emoji_flows_to_entries_and_tasks(self):
        store = SQLiteJobStore(self.db)
        job = store.create_job("Acme", "#0a84ff", emoji="🌸")
        entry = store.create_entry(job["id"], date(2026, 11, 18), "Posted")
        self.assertEqual(entry["job_emoji"], "🌸")
        task = SQLiteTaskStore(self.db).create_task("Write", job_id=job["id"])
        self.assertEqual(task["job_emoji"], "🌸")

    def test_rejects_text_instead_of_emoji(self):
        store = SQLiteJobStore(self.db)
        for bad in ("cat", "🐱 cat", "<b>", "x" * 17, "🐱" * 17):
            with self.assertRaises(ValueError, msg=bad):
                store.create_job(f"Job {bad}", "#0a84ff", emoji=bad)

    def test_migrates_database_created_before_emoji(self):
        with closing(sqlite3.connect(self.db)) as con, con:
            con.execute(
                "CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "name TEXT NOT NULL COLLATE NOCASE UNIQUE, client TEXT, "
                "color TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', "
                "created_at TEXT NOT NULL)"
            )
            con.execute(
                "INSERT INTO jobs (name, color, created_at) "
                "VALUES ('Old job', '#30d158', '2026-11-01T09:00:00')"
            )
        jobs = SQLiteJobStore(self.db).list_jobs()
        self.assertEqual(jobs[0]["name"], "Old job")
        self.assertIsNone(jobs[0]["emoji"])
        # Opening again is a no-op.
        self.assertEqual(len(SQLiteJobStore(self.db).list_jobs()), 1)

    def test_api_round_trip(self):
        with patch(
            "devtrack.api.main.SQLiteJobStore",
            side_effect=lambda: SQLiteJobStore(self.db),
        ):
            client = TestClient(app)
            response = client.post("/api/jobs", json={"name": "Acme", "emoji": "🦄"})
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.json()["emoji"], "🦄")
            self.assertEqual(
                client.post("/api/jobs", json={"name": "Bad", "emoji": "abc"}).status_code,
                422,
            )


if __name__ == "__main__":
    unittest.main()
