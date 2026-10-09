
from datetime import date

from devtrack.storage.sqlite_store import SQLiteActivityStore
from devtrack.storage.checkin_store import SQLiteCheckInStore


class DailyJournalService:
    def __init__(self, activity_store=None, checkin_store=None):
        self.activity_store = (
            activity_store
            if activity_store is not None
            else SQLiteActivityStore()
        )

        self.checkin_store = (
            checkin_store
            if checkin_store is not None
            else SQLiteCheckInStore()
        )

    def get_daily_journal(self, day=None):
        if day is None:
            day = date.today()

        activities = (
            self.activity_store.get_daily_timeline_grouped(day)
        )

        checkins = (
            self.checkin_store.get_daily_checkins(day)
        )

        return {
            "date": day.isoformat(),
            "activities": activities,
            "checkins": checkins,
        }
