
from fastapi import FastAPI
from pathlib import Path
from fastapi.staticfiles import StaticFiles

from devtrack.summary.service import DailySummaryService
from pydantic import BaseModel, Field
from devtrack.models.checkin import DeveloperCheckIn
from devtrack.storage.checkin_store import SQLiteCheckInStore
from datetime import date
from fastapi import HTTPException
from devtrack.journal.service import DailyJournalService
from fastapi.responses import Response
from devtrack.summary.formatter import MarkdownSummaryFormatter

from devtrack.models.settings import TrackerSettings
from devtrack.storage.settings_store import JSONSettingsStore


class CheckInRequest(BaseModel):
    project_name: str = Field(min_length=1)
    work_description: str = Field(min_length=1)
    category: str = "Other"
    blocker: str | None = None

app = FastAPI(
    title="DevTracker API",
    version="0.5.0",
)


class TrackerSettingsRequest(BaseModel):
    # Existing tracking preferences
    tracking_enabled: bool
    poll_interval: int
    idle_threshold: int
    min_activity_duration: int
    collect_window_titles: bool

    # Smart check-in reminder preferences
    # Defaults preserve compatibility with older API clients.
    reminders_enabled: bool = True
    reminder_interval_minutes: int = 60
    reminder_work_start: str = "09:00"
    reminder_work_end: str = "18:00"
    reminder_snooze_minutes: int = 15
    reminders_respect_idle: bool = True



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



@app.post("/api/checkins", status_code=201)
def create_checkin(payload: CheckInRequest):
    project_name = payload.project_name.strip()
    work_description = payload.work_description.strip()
    category = payload.category.strip() or "Other"

    if not project_name or not work_description:
        raise HTTPException(
            status_code=422,
            detail="Project name and work description are required.",
        )

    checkin = DeveloperCheckIn(
        project_name=project_name,
        work_description=work_description,
        category=category,
        blocker=payload.blocker.strip() or None
        if payload.blocker is not None
        else None,
    )

    store = SQLiteCheckInStore()
    checkin_id = store.save(checkin)

    return {
        "id": checkin_id,
        "project_name": checkin.project_name,
        "work_description": checkin.work_description,
        "category": checkin.category,
        "blocker": checkin.blocker,
        "created_at": checkin.created_at.isoformat(),
    }


@app.get("/api/checkins/{day}")
def get_checkins(day: str):
    try:
        selected_day = date.fromisoformat(day)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date. Use YYYY-MM-DD.",
        )

    store = SQLiteCheckInStore()
    checkins = store.get_daily_checkins(selected_day)

    return {
        "date": selected_day.isoformat(),
        "checkins": checkins,
        "total_checkins": len(checkins),
    }


@app.get("/api/reports/{day}")
def get_daily_report(day: str):
    try:
        selected_day = date.fromisoformat(day)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date. Use YYYY-MM-DD.",
        )

    summary = DailySummaryService().generate(selected_day)
    return summary



@app.get("/api/reports/{day}/download")
def download_daily_report(day: str):
    try:
        selected_day = date.fromisoformat(day)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date. Use YYYY-MM-DD.",
        )

    summary = DailySummaryService().generate(selected_day)

    markdown = MarkdownSummaryFormatter().format(summary)

    filename = f"{selected_day.isoformat()}.md"

    return Response(
        content=markdown,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@app.get("/api/settings")
def get_tracker_settings():
    store = JSONSettingsStore()

    try:
        settings = store.load()
    except (ValueError, TypeError, OSError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to load tracker settings.",
        ) from exc

    return settings.to_dict()


@app.put("/api/settings")
def update_tracker_settings(payload: TrackerSettingsRequest):
    try:
        settings = TrackerSettings(
            **payload.model_dump()
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    store = JSONSettingsStore()

    try:
        store.save(settings)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to save tracker settings.",
        ) from exc

    return settings.to_dict()


# ------------------------------------------
# Serve DevTracker React production frontend
# ------------------------------------------

FRONTEND_DIST = (
    Path(__file__).resolve().parents[3]
    / "frontend"
    / "dist"
)

if FRONTEND_DIST.is_dir():
    app.mount(
        "/",
        StaticFiles(
            directory=str(FRONTEND_DIST),
            html=True,
        ),
        name="frontend",
    )
