
import json
import unittest
from datetime import datetime
from pathlib import Path
from tempfile import TemporaryDirectory

from devtrack.reminders.state import ReminderState
from devtrack.reminders.state_store import JSONReminderStateStore


class TestReminderStateStore(unittest.TestCase):

    def setUp(self):
        self.folder = TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)

        self.path = Path(self.folder.name) / "reminder_state.json"
        self.store = JSONReminderStateStore(self.path)

    def test_missing_file_returns_empty_state(self):
        state = self.store.load()

        self.assertFalse(state.pending)
        self.assertIsNone(state.snoozed_until)

    def test_snoozed_reminder_survives_restart(self):
        original = ReminderState()
        original.mark_due()
        original.snooze(
            15,
            datetime(2026, 10, 13, 10, 0),
        )

        self.store.save(original)
        restored = self.store.load()

        self.assertTrue(restored.pending)
        self.assertEqual(
            restored.snoozed_until,
            datetime(2026, 10, 13, 10, 15),
        )

    def test_unsnoozed_pending_state_resets_on_restart(self):
        original = ReminderState()
        original.mark_due()

        self.store.save(original)
        restored = self.store.load()

        self.assertFalse(restored.pending)
        self.assertIsNone(restored.snoozed_until)

    def test_skipped_reminder_stays_cleared(self):
        original = ReminderState()
        original.mark_due()
        original.skip()

        self.store.save(original)
        restored = self.store.load()

        self.assertFalse(restored.pending)

    def test_invalid_file_is_rejected(self):
        self.path.write_text(
            json.dumps({
                "pending": "yes",
                "snoozed_until": None,
            }),
            encoding="utf-8",
        )

        with self.assertRaises(ValueError):
            self.store.load()

    
    def test_reminder_id_survives_restart(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from datetime import datetime

        with TemporaryDirectory() as folder:
            path = Path(folder) / "reminder.json"
            store = JSONReminderStateStore(path)

            state = ReminderState()
            state.mark_due()
            original_id = state.reminder_id
            state.snooze(15, datetime.now())

            store.save(state)

            restored = JSONReminderStateStore(path).load()

            self.assertTrue(restored.pending)
            self.assertEqual(restored.reminder_id, original_id)
            self.assertEqual(
                restored.snoozed_until,
                state.snoozed_until,
            )

    def test_legacy_snooze_gets_new_id(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from datetime import datetime, timedelta

        with TemporaryDirectory() as folder:
            path = Path(folder) / "reminder.json"

            deadline = (
                datetime.now() + timedelta(minutes=15)
            ).isoformat()

            path.write_text(
                json.dumps({
                    "pending": True,
                    "snoozed_until": deadline,
                }),
                encoding="utf-8",
            )

            restored = JSONReminderStateStore(path).load()

            self.assertTrue(restored.pending)
            self.assertIsNotNone(restored.reminder_id)
            self.assertEqual(len(restored.reminder_id), 32)

    def test_invalid_reminder_id_rejected(self):
        from pathlib import Path
        from tempfile import TemporaryDirectory
        from datetime import datetime, timedelta

        with TemporaryDirectory() as folder:
            path = Path(folder) / "reminder.json"

            deadline = (
                datetime.now() + timedelta(minutes=15)
            ).isoformat()

            path.write_text(
                json.dumps({
                    "pending": True,
                    "snoozed_until": deadline,
                    "reminder_id": "invalid-id",
                }),
                encoding="utf-8",
            )

            with self.assertRaises(ValueError):
                JSONReminderStateStore(path).load()

if __name__ == "__main__":
    unittest.main()
