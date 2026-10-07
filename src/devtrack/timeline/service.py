from datetime import date

from devtrack.storage.sqlite_store import SQLiteActivityStore


class TimelineService:
    def __init__(self, store=None):
        self.store = store or SQLiteActivityStore()

    def get_daily_timeline(self, day: date):
        return self.store.get_daily_timeline_grouped(day)