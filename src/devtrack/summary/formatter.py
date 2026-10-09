
class MarkdownSummaryFormatter:

    def format(self, summary):
        lines = [
            "# DevTracker — Daily Work Report",
            "",
            f"**Date:** {summary['date']}",
            "",
            "## Overview",
            "",
            f"- Tracked application time: "
            f"{self.format_duration(summary['total_tracked_seconds'])}",
            f"- Activities recorded: {summary['activity_count']}",
            f"- Developer check-ins: {summary['checkin_count']}",
            "",
            "## Projects",
            "",
        ]

        projects = summary["projects"]

        if not projects:
            lines.append("No developer check-ins recorded.")
            lines.append("")

        for name, details in projects.items():
            lines.append(f"### {name}")
            lines.append("")

            lines.append("**Work recorded:**")
            for work in details["work"]:
                lines.append(f"- {work}")

            lines.append("")
            lines.append(
                f"**Categories:** {', '.join(details['categories'])}"
            )
            lines.append("")

            lines.append("**Blockers:**")
            if details["blockers"]:
                for blocker in details["blockers"]:
                    lines.append(f"- {blocker}")
            else:
                lines.append("- None recorded")

            lines.append("")

        lines.extend([
            "## Application Usage",
            "",
        ])

        usage = summary["application_usage"]

        if not usage:
            lines.append("No application activity recorded.")
        else:
            for app, seconds in sorted(
                usage.items(),
                key=lambda item: item[1],
                reverse=True,
            ):
                lines.append(
                    f"- {app}: {self.format_duration(seconds)}"
                )

        return "\n".join(lines) + "\n"

    @staticmethod
    def format_duration(seconds):
        total = int(seconds)
        hours, remainder = divmod(total, 3600)
        minutes, secs = divmod(remainder, 60)

        if hours:
            return f"{hours}h {minutes}m {secs}s"

        if minutes:
            return f"{minutes}m {secs}s"

        return f"{secs}s"
