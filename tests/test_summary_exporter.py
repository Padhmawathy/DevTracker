
import tempfile
import unittest
from pathlib import Path

from devtrack.summary.exporter import MarkdownReportExporter


class FakeSummaryService:
    def generate(self, day=None):
        return {
            "date": "2026-10-09",
            "total_tracked_seconds": 120,
            "activity_count": 1,
            "checkin_count": 1,
            "projects": {
                "DevTracker": {
                    "work": ["Built the report exporter"],
                    "categories": ["Coding"],
                    "blockers": [],
                }
            },
            "application_usage": {
                "Code.exe": 120,
            },
        }


class TestMarkdownReportExporter(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()

        self.exporter = MarkdownReportExporter(
            summary_service=FakeSummaryService(),
            output_dir=self.temp_dir.name,
        )

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_creates_markdown_file(self):
        filepath = self.exporter.export()

        self.assertTrue(filepath.exists())
        self.assertEqual(filepath.suffix, ".md")

    def test_uses_report_date_as_filename(self):
        filepath = self.exporter.export()

        self.assertEqual(
            filepath.name,
            "2026-10-09.md",
        )

    def test_writes_report_content(self):
        filepath = self.exporter.export()
        content = filepath.read_text(encoding="utf-8")

        self.assertIn("# DevTracker", content)
        self.assertIn("Built the report exporter", content)
        self.assertIn("Code.exe: 2m 0s", content)

    def test_export_returns_correct_directory(self):
        filepath = self.exporter.export()

        self.assertEqual(
            filepath.parent,
            Path(self.temp_dir.name),
        )

    def test_export_overwrites_existing_report(self):
        first_path = self.exporter.export()
        first_path.write_text("Old content", encoding="utf-8")

        second_path = self.exporter.export()

        self.assertEqual(first_path, second_path)
        self.assertNotIn(
            "Old content",
            second_path.read_text(encoding="utf-8"),
        )


if __name__ == "__main__":
    unittest.main()
