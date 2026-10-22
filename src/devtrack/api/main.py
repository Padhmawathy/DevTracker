import sys
from fastapi import FastAPI
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from devtrack.models.profile import DeveloperProfile
from devtrack.storage.profile_store import JSONDeveloperProfileStore
import hmac
from fastapi import Request
from fastapi.responses import JSONResponse
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

from devtrack.models.app_category import AppCategoryRule
from devtrack.storage.app_category_store import JSONAppCategoryStore
from devtrack.reminders.action_queue import ReminderActionQueue

app = FastAPI(
    title="DevTracker API",
    version="0.5.0",
)

# Allow the packaged DevTrack Windows frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://tauri.localhost"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def require_desktop_auth(request: Request, call_next):
    expected_token = getattr(app.state, "desktop_api_token", None)

    # Development mode uses the separately started backend.
    if expected_token is None:
        return await call_next(request)

    if request.method == "OPTIONS":
        return await call_next(request)

    if request.url.path.startswith("/api/"):
        supplied_token = request.headers.get(
            "X-DevTrack-Token", ""
        )

        if not hmac.compare_digest(
            supplied_token, expected_token
        ):
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized"},
            )

    return await call_next(request)

class CheckInRequest(BaseModel):
    project_name: str = Field(min_length=1)
    work_description: str = Field(min_length=1)
    category: str = "Other"
    blocker: str | None = None

class ReminderActionRequest(BaseModel):
    action: str
    reminder_id: str

class TrackerSettingsRequest(BaseModel):
    tracking_enabled: bool
    tracking_consent_granted: bool = False
    poll_interval: int
    idle_threshold: int
    min_activity_duration: int
    collect_window_titles: bool

    reminders_enabled: bool = True
    reminder_interval_minutes: int = 60
    reminder_work_start: str = "09:00"
    reminder_work_end: str = "18:00"
    reminder_snooze_minutes: int = 15
    reminders_respect_idle: bool = True


class DeveloperProfileRequest(BaseModel):
    display_name: str = ""
    role: str = "fullstack"
    primary_language: str = ""
    primary_editor: str = ""
    daily_focus_goal_minutes: int = Field(
        default=240,
        strict=True,
    )


class AppCategoryRuleRequest(BaseModel):
    app_name: str
    category: str


class AppCategoriesRequest(BaseModel):
    rules: list[AppCategoryRuleRequest]


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "application": "DevTracker",
    }

@app.post("/api/reminders/action")
def submit_reminder_action(payload: ReminderActionRequest):
    if payload.action not in ("snooze", "skip"):
        raise HTTPException(
            status_code=422,
            detail="Invalid reminder action",
        )

    queue = ReminderActionQueue()

    try:
        queue._validate_reminder_id(payload.reminder_id)
        queue.enqueue(payload.action, payload.reminder_id)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Invalid reminder ID",
        )

    return {
        "status": "queued",
        "action": payload.action,
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


@app.get("/api/profile")
def get_developer_profile():
    store = JSONDeveloperProfileStore()

    try:
        profile = store.load()
    except (ValueError, TypeError, OSError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to load developer profile.",
        ) from exc

    return profile.to_dict()


@app.put("/api/profile")
def update_developer_profile(payload: DeveloperProfileRequest):
    try:
        profile = DeveloperProfile(
            **payload.model_dump()
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    store = JSONDeveloperProfileStore()

    try:
        store.save(profile)
    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to save developer profile.",
        ) from exc

    return profile.to_dict()



@app.get("/api/app-categories")
def get_app_categories():
    store = JSONAppCategoryStore()

    try:
        rules = store.load()
    except (ValueError, TypeError, OSError) as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to load application categories.",
        ) from exc

    return {
        "rules": [
            {
                "app_name": rule.app_name,
                "category": rule.category,
            }
            for rule in rules
        ]
    }


@app.put("/api/app-categories")
def update_app_categories(payload: AppCategoriesRequest):
    try:
        rules = [
            AppCategoryRule(
                app_name=item.app_name,
                category=item.category,
            )
            for item in payload.rules
        ]

        store = JSONAppCategoryStore()
        store.save(rules)

    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except OSError as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to save application categories.",
        ) from exc

    return {
        "rules": [
            {
                "app_name": rule.app_name,
                "category": rule.category,
            }
            for rule in rules
        ]
    }

# ------------------------------------------
# Serve DevTracker React production frontend
# ------------------------------------------

def get_frontend_dist() -> Path:
    """Locate React assets in development or PyInstaller."""

    if getattr(sys, "frozen", False):
        return (
            Path(__file__).resolve().parents[3]
            if not hasattr(sys, "_MEIPASS")
            else Path(sys._MEIPASS)
        ) / "frontend" / "dist"

    return (
        Path(__file__).resolve().parents[3]
        / "frontend"
        / "dist"
    )


FRONTEND_DIST = get_frontend_dist()

if FRONTEND_DIST.is_dir():
    app.mount(
        "/",
        StaticFiles(
            directory=str(FRONTEND_DIST),
            html=True,
        ),
        name="frontend",
    )
