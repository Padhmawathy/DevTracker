import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from devtrack.api.main import app
from devtrack.storage.job_store import (
    DuplicateJobError,
    JobNotFoundError,
    SQLiteJobStore,
    WorkEntryNotFoundError,
)


class TestSQLiteJobStore(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = SQLiteJobStore(Path(self.tmp.name) / "test.db")

    def tearDown(self):
        self.tmp.cleanup()

    def test_create_and_list_job_with_totals(self):
        job = self.store.create_job("Acme Social", "#AABBCC", client="Acme")
        self.assertEqual(job["color"], "#aabbcc")
        self.assertEqual(job["done_hours"], 0)

        self.store.create_entry(job["id"], date(2026, 11, 3), "Wrote post",
                                hours=1.5, platform="linkedin")
        self.store.create_entry(job["id"], date(2026, 11, 4), "Plan reel",
                                hours=2, status="planned")
        self.store.create_entry(job["id"], date(2026, 11, 5), "Thread",
                                platform="x")

        [listed] = self.store.list_jobs()
        self.assertEqual(listed["done_hours"], 1.5)
        self.assertEqual(listed["planned_hours"], 2)
        self.assertEqual(listed["entry_count"], 3)
        self.assertEqual(listed["post_count"], 2)
        self.assertEqual(listed["last_entry_date"], "2026-11-05")

    def test_duplicate_job_name_is_case_insensitive(self):
        self.store.create_job("Acme", "#000000")
        with self.assertRaises(DuplicateJobError):
            self.store.create_job("acme", "#111111")

    def test_archived_jobs_can_be_hidden(self):
        self.store.create_job("Old", "#000000", status="archived")
        self.store.create_job("New", "#000000")
        names = [j["name"] for j in self.store.list_jobs(include_archived=False)]
        self.assertEqual(names, ["New"])

    def test_entries_filtered_by_range_and_job(self):
        a = self.store.create_job("A", "#000000")
        b = self.store.create_job("B", "#ffffff")
        self.store.create_entry(a["id"], date(2026, 10, 31), "before")
        self.store.create_entry(a["id"], date(2026, 11, 1), "a in")
        self.store.create_entry(b["id"], date(2026, 11, 30), "b in")
        self.store.create_entry(b["id"], date(2026, 12, 1), "after")

        entries = self.store.list_entries(date(2026, 11, 1), date(2026, 11, 30))
        self.assertEqual([e["description"] for e in entries], ["a in", "b in"])
        self.assertEqual(entries[1]["job_name"], "B")

        only_a = self.store.list_entries(
            date(2026, 11, 1), date(2026, 11, 30), job_id=a["id"]
        )
        self.assertEqual([e["description"] for e in only_a], ["a in"])

    def test_update_and_delete_entry(self):
        job = self.store.create_job("A", "#000000")
        entry = self.store.create_entry(job["id"], date(2026, 11, 1), "draft",
                                        status="planned")
        updated = self.store.update_entry(
            entry["id"], job["id"], date(2026, 11, 2), "posted",
            status="done", platform="reddit",
            link="https://reddit.com/r/x/1",
        )
        self.assertEqual(updated["entry_date"], "2026-11-02")
        self.assertEqual(updated["platform"], "reddit")
        self.assertIsNone(updated["hours"])

        self.store.delete_entry(entry["id"])
        with self.assertRaises(WorkEntryNotFoundError):
            self.store.get_entry(entry["id"])

    def test_entry_validation(self):
        job = self.store.create_job("A", "#000000")
        day = date(2026, 11, 1)
        with self.assertRaises(ValueError):
            self.store.create_entry(job["id"], day, "x", hours=25)
        with self.assertRaises(ValueError):
            self.store.create_entry(job["id"], day, "x", platform="myspace")
        with self.assertRaises(ValueError):
            self.store.create_entry(job["id"], day, "x", link="javascript:alert(1)")
        with self.assertRaises(ValueError):
            self.store.create_entry(job["id"], day, "   ")
        with self.assertRaises(JobNotFoundError):
            self.store.create_entry(999, day, "x")


class TestJobCalendarAPI(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        db_path = Path(self.tmp.name) / "api.db"
        patcher = patch(
            "devtrack.api.main.SQLiteJobStore",
            side_effect=lambda: SQLiteJobStore(db_path),
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client = TestClient(app)

    def tearDown(self):
        self.tmp.cleanup()

    def _job(self, name="Acme"):
        response = self.client.post(
            "/api/jobs", json={"name": name, "client": "Acme Inc"}
        )
        self.assertEqual(response.status_code, 201)
        return response.json()

    def test_job_crud(self):
        job = self._job()
        self.assertEqual(self.client.post("/api/jobs", json={"name": "acme"}).status_code, 409)

        response = self.client.put(
            f"/api/jobs/{job['id']}",
            json={"name": "Acme", "color": "#123456", "status": "archived"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "archived")

        response = self.client.get("/api/jobs?include_archived=false")
        self.assertEqual(response.json()["jobs"], [])

        self.assertEqual(
            self.client.put("/api/jobs/999", json={"name": "Z"}).status_code, 404
        )
        self.assertEqual(
            self.client.post("/api/jobs", json={"name": "Q", "color": "red"}).status_code,
            422,
        )

    def test_post_log_flow(self):
        job = self._job()
        response = self.client.post(
            "/api/work-entries",
            json={
                "job_id": job["id"],
                "entry_date": "2026-11-18",
                "description": "Launch carousel",
                "platform": "instagram",
                "link": "https://instagram.com/p/abc",
            },
        )
        self.assertEqual(response.status_code, 201)
        entry = response.json()
        self.assertIsNone(entry["hours"])

        listing = self.client.get(
            "/api/work-entries?start=2026-11-01&end=2026-11-30"
        ).json()
        self.assertEqual(len(listing["entries"]), 1)
        self.assertEqual(listing["entries"][0]["platform"], "instagram")

        response = self.client.put(
            f"/api/work-entries/{entry['id']}",
            json={**entry, "hours": 0.5, "platform": "x"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["hours"], 0.5)

        response = self.client.post(f"/api/work-entries/{entry['id']}/delete")
        self.assertEqual(response.status_code, 200)
        response = self.client.post(f"/api/work-entries/{entry['id']}/delete")
        self.assertEqual(response.status_code, 404)

    def test_work_entry_validation(self):
        job = self._job()
        base = {"job_id": job["id"], "entry_date": "2026-11-18", "description": "x"}
        for bad in (
            {"hours": 0},
            {"platform": "tiktok"},
            {"entry_date": "2026-13-01"},
            {"description": ""},
        ):
            response = self.client.post("/api/work-entries", json={**base, **bad})
            self.assertEqual(response.status_code, 422, bad)

        missing_job = self.client.post(
            "/api/work-entries", json={**base, "job_id": 999}
        )
        self.assertEqual(missing_job.status_code, 404)

    def test_work_entry_range_validation(self):
        self.assertEqual(
            self.client.get("/api/work-entries?start=bad&end=2026-11-01").status_code,
            400,
        )
        self.assertEqual(
            self.client.get(
                "/api/work-entries?start=2026-11-02&end=2026-11-01"
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.get(
                "/api/work-entries?start=2020-01-01&end=2026-11-01"
            ).status_code,
            400,
        )


if __name__ == "__main__":
    unittest.main()
