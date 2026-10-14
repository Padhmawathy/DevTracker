
import unittest
from datetime import datetime, timedelta

from devtrack.reminders.state import ReminderState


class TestReminderState(unittest.TestCase):

    def setUp(self):
        self.state = ReminderState()
        self.now = datetime(2026, 10, 13, 10, 0)

    def test_mark_due(self):
        self.assertTrue(self.state.mark_due())
        self.assertTrue(self.state.pending)

    def test_prevent_duplicate_reminders(self):
        self.state.mark_due()
        self.assertFalse(self.state.mark_due())

    def test_snooze_sets_deadline(self):
        self.state.mark_due()
        self.state.snooze(15, self.now)

        self.assertEqual(
            self.state.snoozed_until,
            self.now + timedelta(minutes=15),
        )

    def test_snooze_not_due_early(self):
        self.state.mark_due()
        self.state.snooze(15, self.now)

        self.assertFalse(
            self.state.is_snooze_due(
                self.now + timedelta(minutes=10)
            )
        )

    def test_snooze_due_after_deadline(self):
        self.state.mark_due()
        self.state.snooze(15, self.now)

        self.assertTrue(
            self.state.is_snooze_due(
                self.now + timedelta(minutes=15)
            )
        )

    def test_skip_clears_reminder(self):
        self.state.mark_due()
        self.state.snooze(15, self.now)
        self.state.skip()

        self.assertFalse(self.state.pending)
        self.assertIsNone(self.state.snoozed_until)

    def test_complete_checkin_clears_reminder(self):
        self.state.mark_due()
        self.state.complete_checkin()

        self.assertFalse(self.state.pending)

    def test_cannot_snooze_without_reminder(self):
        with self.assertRaises(ValueError):
            self.state.snooze(15, self.now)


    
    def test_new_reminder_has_unique_id(self):
        state = ReminderState()

        state.mark_due()
        first_id = state.reminder_id

        self.assertIsNotNone(first_id)

        state.skip()
        state.mark_due()

        self.assertIsNotNone(state.reminder_id)
        self.assertNotEqual(first_id, state.reminder_id)

    def test_snooze_preserves_reminder_id(self):
        state = ReminderState()
        state.mark_due()

        original_id = state.reminder_id

        state.snooze(15, datetime.now())
        self.assertEqual(state.reminder_id, original_id)

        state.acknowledge_snooze()
        self.assertEqual(state.reminder_id, original_id)

    def test_skip_clears_reminder_id(self):
        state = ReminderState()
        state.mark_due()

        self.assertIsNotNone(state.reminder_id)

        state.skip()

        self.assertIsNone(state.reminder_id)



if __name__ == "__main__":
    unittest.main()
