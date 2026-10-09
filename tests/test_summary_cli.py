
import sys
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

from devtrack.summary_cli import main


class TestSummaryCLI(unittest.TestCase):

    @patch("devtrack.summary_cli.MarkdownReportExporter")
    def test_default_arguments(self, mock_exporter):
        mock_exporter.return_value.export.return_value = Path(
            "reports/2026-10-09.md"
        )

        with patch.object(sys, "argv", ["summary_cli"]):
            with patch("builtins.print") as mock_print:
                main()

        mock_exporter.assert_called_once_with(
            output_dir="reports"
        )
        mock_exporter.return_value.export.assert_called_once()

        mock_print.assert_called_once()

    @patch("devtrack.summary_cli.MarkdownReportExporter")
    def test_custom_date(self, mock_exporter):
        with patch.object(
            sys,
            "argv",
            ["summary_cli", "--date", "2026-10-09"],
        ):
            main()

        mock_exporter.return_value.export.assert_called_once_with(
            date(2026, 10, 9)
        )

    @patch("devtrack.summary_cli.MarkdownReportExporter")
    def test_custom_output_directory(self, mock_exporter):
        with patch.object(
            sys,
            "argv",
            ["summary_cli", "--output", "my_reports"],
        ):
            main()

        mock_exporter.assert_called_once_with(
            output_dir="my_reports"
        )

    def test_invalid_date(self):
        with patch.object(
            sys,
            "argv",
            ["summary_cli", "--date", "invalid-date"],
        ):
            with patch("sys.stderr"):
                with self.assertRaises(SystemExit) as error:
                    main()

        self.assertEqual(error.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
