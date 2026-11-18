import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from devtrack.api.main import app
from devtrack.storage.job_store import JobNotFoundError, SQLiteJobStore
from devtrack.storage.task_store import SQLiteTaskStore, TaskNotFoundError


class TestSQLiteTaskStore(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "tasks.db"
        self.store = SQLiteTaskStore(self.db)

    def tearDown(self):
        self.tmp.cleanup()

    def test_create_with_job_and_defaults(self):
        job = SQLiteJobStore(self.db).create_job("Acme", "#0a84ff")
        task = self.store.create_task("Write post", job_id=job["id"])
        self.assertEqual(task["status"], "todo")
        self.assertEqual(task["priority"], "none")
        self.assertEqual(task["job_name"], "Acme")
        self.assertIsNone(task["completed_at"])

    def test_ordering_open_before_done_and_by_due_date(self):
        self.store.create_task("no date")
        self.store.create_task("later", due_date=date(2026, 12, 5))
        self.store.create_task("sooner", due_date=date(2026, 11, 20))
        self.store.create_task("finished", status="done")
        titles = [t["title"] for t in self.store.list_tasks()]
        self.assertEqual(titles, ["sooner", "later", "no date", "finished"])

    def test_priority_breaks_ties_on_same_day(self):
        day = date(2026, 11, 20)
        self.store.create_task("low", due_date=day, priority="low")
        self.store.create_task("high", due_date=day, priority="high")
        titles = [t["title"] for t in self.store.list_tasks()]
        self.assertEqual(titles, ["high", "low"])

    def test_completed_at_tracks_status(self):
        task = self.store.create_task("x")
        done = self.store.update_task(task["id"], "x", status="done")
        self.assertIsNotNone(done["completed_at"])

        edited = self.store.update_task(task["id"], "x renamed", status="done")
        self.assertEqual(edited["completed_at"], done["completed_at"])

        reopened = self.store.update_task(task["id"], "x", status="todo")
        self.assertIsNone(reopened["completed_at"])

    def test_update_clears_optional_fields(self):
        task = self.store.create_task(
            "x", notes="n", due_date=date(2026, 11, 20), priority="high"
        )
        updated = self.store.update_task(task["id"], "x")
        self.assertIsNone(updated["notes"])
        self.assertIsNone(updated["due_date"])
        self.assertEqual(updated["priority"], "none")

    def test_delete(self):
        task = self.store.create_task("x")
        self.store.delete_task(task["id"])
        with self.assertRaises(TaskNotFoundError):
            self.store.get_task(task["id"])
        with self.assertRaises(TaskNotFoundError):
            self.store.delete_task(task["id"])

    def test_validation(self):
        with self.assertRaises(ValueError):
            self.store.create_task("   ")
        with self.assertRaises(ValueError):
            self.store.create_task("x", priority="urgent")
        with self.assertRaises(ValueError):
            self.store.create_task("x", status="blocked")
        with self.assertRaises(ValueError):
            self.store.create_task("x" * 201)
        with self.assertRaises(JobNotFoundError):
            self.store.create_task("x", job_id=999)
        with self.assertRaises(TaskNotFoundError):
            self.store.update_task(999, "x")


class TestTasksAPI(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        db = Path(self.tmp.name) / "api.db"
        for target, cls in (
            ("devtrack.api.main.SQLiteTaskStore", SQLiteTaskStore),
            ("devtrack.api.main.SQLiteJobStore", SQLiteJobStore),
        ):
            patcher = patch(target, side_effect=lambda cls=cls: cls(db))
            patcher.start()
            self.addCleanup(patcher.stop)
        self.client = TestClient(app)

    def tearDown(self):
        self.tmp.cleanup()

    def test_task_lifecycle(self):
        job = self.client.post("/api/jobs", json={"name": "Acme"}).json()

        response = self.client.post(
            "/api/tasks",
            json={
                "title": "Draft LinkedIn post",
                "due_date": "2026-11-20",
                "priority": "high",
                "job_id": job["id"],
            },
        )
        self.assertEqual(response.status_code, 201)
        task = response.json()
        self.assertEqual(task["job_name"], "Acme")

        tasks = self.client.get("/api/tasks").json()["tasks"]
        self.assertEqual([t["id"] for t in tasks], [task["id"]])

        response = self.client.put(
            f"/api/tasks/{task['id']}",
            json={**task, "status": "done"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.json()["completed_at"])

        self.assertEqual(
            self.client.post(f"/api/tasks/{task['id']}/delete").status_code, 200
        )
        self.assertEqual(
            self.client.post(f"/api/tasks/{task['id']}/delete").status_code, 404
        )

    def test_validation_errors(self):
        for bad in (
            {"title": ""},
            {"title": "x", "priority": "urgent"},
            {"title": "x", "status": "blocked"},
            {"title": "x", "due_date": "2026-02-30"},
        ):
            self.assertEqual(
                self.client.post("/api/tasks", json=bad).status_code, 422, bad
            )
        self.assertEqual(
            self.client.post("/api/tasks", json={"title": "x", "job_id": 999}).status_code,
            404,
        )
        self.assertEqual(
            self.client.put("/api/tasks/999", json={"title": "x"}).status_code, 404
        )


if __name__ == "__main__":
    unittest.main()
