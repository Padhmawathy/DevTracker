
from datetime import date

from devtrack.journal.service import DailyJournalService


class DailySummaryService:
    def __init__(self, journal_service=None):
        self.journal_service = (
            journal_service
            if journal_service is not None
            else DailyJournalService()
        )

    def generate(self, day=None):
        if day is None:
            day = date.today()

        journal = self.journal_service.get_daily_journal(day)

        activities = journal["activities"]
        checkins = journal["checkins"]

        # Summarize tracked application usage
        app_usage = {}

        for activity in activities:
            app = activity["process_name"]
            duration = activity["duration_seconds"]

            app_usage[app] = app_usage.get(app, 0) + duration

        total_seconds = sum(app_usage.values())

        # Group developer check-ins by project
        projects = {}

        for checkin in checkins:
            project_name = checkin["project_name"]

            if project_name not in projects:
                projects[project_name] = {
                    "work": [],
                    "categories": [],
                    "blockers": [],
                }

            project = projects[project_name]

            project["work"].append(
                checkin["work_description"]
            )

            category = checkin["category"]

            if category not in project["categories"]:
                project["categories"].append(category)

            blocker = checkin["blocker"]

            if blocker:
                project["blockers"].append(blocker)

        return {
            "date": journal["date"],
            "total_tracked_seconds": total_seconds,
            "application_usage": app_usage,
            "projects": projects,
            "activity_count": len(activities),
            "checkin_count": len(checkins),
        }
