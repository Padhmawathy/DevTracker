
from pathlib import Path

from devtrack.summary.service import DailySummaryService
from devtrack.summary.formatter import MarkdownSummaryFormatter


class MarkdownReportExporter:

    def __init__(
        self,
        summary_service=None,
        formatter=None,
        output_dir="reports",
    ):
        self.summary_service = (
            summary_service
            if summary_service is not None
            else DailySummaryService()
        )

        self.formatter = (
            formatter
            if formatter is not None
            else MarkdownSummaryFormatter()
        )

        self.output_dir = Path(output_dir)

    def export(self, day=None):
        summary = self.summary_service.generate(day)
        markdown = self.formatter.format(summary)

        self.output_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        filename = f"{summary['date']}.md"
        filepath = self.output_dir / filename

        filepath.write_text(
            markdown,
            encoding="utf-8",
        )

        return filepath
