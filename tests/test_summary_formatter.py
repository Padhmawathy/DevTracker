
import unittest

from devtrack.summary.formatter import MarkdownSummaryFormatter


class TestMarkdownSummaryFormatter(unittest.TestCase):

    def setUp(self):
        self.formatter = MarkdownSummaryFormatter()

        self.summary = {
            "date": "2026-10-09",
            "total_tracked_seconds": 3665,
            "activity_count": 3,
            "checkin_count": 2,
            "projects": {
                "DevTracker": {
                    "work": [
                        "Implemented summary service",
                        "Fixed an import error",
                    ],
                    "categories": ["Coding", "Debugging"],
                    "blockers": ["Incorrect module path"],
                }
            },
            "application_usage": {
                "Code.exe": 3600,
                "brave.exe": 65,
            },
        }

    def test_report_heading_and_date(self):
        report = self.formatter.format(self.summary)

        self.assertIn("# DevTracker", report)
        self.assertIn("2026-10-09", report)

    def test_overview(self):
        report = self.formatter.format(self.summary)

        self.assertIn("1h 1m 5s", report)
        self.assertIn("Activities recorded: 3", report)
        self.assertIn("Developer check-ins: 2", report)

    def test_project_work_and_categories(self):
        report = self.formatter.format(self.summary)

        self.assertIn("### DevTracker", report)
        self.assertIn("- Implemented summary service", report)
        self.assertIn("- Fixed an import error", report)
        self.assertIn("Coding, Debugging", report)

    def test_blockers(self):
        report = self.formatter.format(self.summary)

        self.assertIn("- Incorrect module path", report)

    def test_application_usage(self):
        report = self.formatter.format(self.summary)

        self.assertIn("- Code.exe: 1h 0m 0s", report)
        self.assertIn("- brave.exe: 1m 5s", report)

    def test_empty_report(self):
        empty_summary = {
            "date": "2026-10-09",
            "total_tracked_seconds": 0,
            "activity_count": 0,
            "checkin_count": 0,
            "projects": {},
            "application_usage": {},
        }

        report = self.formatter.format(empty_summary)

        self.assertIn(
            "No developer check-ins recorded.",
            report,
        )
        self.assertIn(
            "No application activity recorded.",
            report,
        )

    def test_duration_formatting(self):
        self.assertEqual(
            self.formatter.format_duration(65),
            "1m 5s",
        )
        self.assertEqual(
            self.formatter.format_duration(3665),
            "1h 1m 5s",
        )
        self.assertEqual(
            self.formatter.format_duration(45),
            "45s",
        )


if __name__ == "__main__":
    unittest.main()
