
from fastapi import FastAPI

from devtrack.summary.service import DailySummaryService

from datetime import date
from fastapi import HTTPException
from devtrack.journal.service import DailyJournalService
app = FastAPI(
    title="DevTracker API",
    version="0.5.0",
)


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "application": "DevTracker",
    }


@app.get("/api/summary/today")
def get_today_summary():
    service = DailySummaryService()
    return service.generate()

@app.get("/api/activity/{day}")
def get_daily_activity(day: str):
    try:
        selected_date = date.fromisoformat(day)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date. Use YYYY-MM-DD.",
        )

    journal_service = DailyJournalService()
    journal = journal_service.get_daily_journal(selected_date)

    return {
        "date": journal["date"],
        "activities": journal["activities"],
        "total_activities": len(journal["activities"]),
    }
