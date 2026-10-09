
import argparse
from datetime import date

from devtrack.summary.exporter import MarkdownReportExporter


def main():
    parser = argparse.ArgumentParser(
        description="Generate DevTracker daily work reports."
    )

    parser.add_argument(
        "--date",
        type=date.fromisoformat,
        default=date.today(),
        help="Report date in YYYY-MM-DD format",
    )

    parser.add_argument(
        "--output",
        default="reports",
        help="Directory where reports are saved",
    )

    args = parser.parse_args()

    exporter = MarkdownReportExporter(
        output_dir=args.output
    )

    filepath = exporter.export(args.date)

    print(f"Report generated successfully: {filepath}")


if __name__ == "__main__":
    main()
