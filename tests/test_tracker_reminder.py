
import unittest
from unittest.mock import MagicMock

from devtrack.collector.tracker import ActivityTracker
from devtrack.models.settings import TrackerSettings
from datetime import datetime, timedelta
from unittest.mock import patch

class TestTrackerReminderIntegration(unittest.TestCase):

    
    def setUp(self):
        from devtrack.reminders.state import ReminderState

        self.tracker = ActivityTracker(
            store=MagicMock()
        )

        # Isolate every test from persistent reminder state.
        self.tracker.reminder_state = ReminderState()

        # Prevent tests from writing to real reminder state storage.
        self.tracker.reminder_state_store = MagicMock()

        self.tracker.current_settings = TrackerSettings(
            reminders_enabled=True,
            reminder_interval_minutes=15,
        )

        self.tracker.reminder_engine = MagicMock()
        self.tracker.notifier = MagicMock()


    def test_active_work_updates_reminder_engine(self):
        self.tracker.reminder_engine.tick.return_value = False

        self.tracker.check_reminder(active=True)

        self.tracker.reminder_engine.tick.assert_called_once_with(
            settings=self.tracker.current_settings,
            active=True,
        )

    def test_idle_state_updates_reminder_engine(self):
        self.tracker.reminder_engine.tick.return_value = False

        self.tracker.check_reminder(active=False)

        self.tracker.reminder_engine.tick.assert_called_once_with(
            settings=self.tracker.current_settings,
            active=False,
        )

    def test_no_reminder_without_settings(self):
        self.tracker.current_settings = None

        self.tracker.check_reminder(active=True)

        self.tracker.reminder_engine.tick.assert_not_called()

    
    def test_snooze_pending_reminder(self):
        self.tracker.reminder_state.mark_due()

        with patch(
            "devtrack.collector.tracker.datetime"
        ) as mock_datetime:
            mock_datetime.now.return_value = datetime(
                2026, 10, 13, 10, 0
            )

            result = self.tracker.snooze_reminder()

        self.assertTrue(result)
        self.assertTrue(self.tracker.reminder_state.pending)

        self.assertEqual(
            self.tracker.reminder_state.snoozed_until,
            datetime(2026, 10, 13, 10, 15),
        )

    def test_skip_resets_reminder_engine(self):
        self.tracker.reminder_state.mark_due()
        self.tracker.reminder_engine.active_seconds = 600
        self.tracker.reminder_engine.last_monotonic = 100.0
        self.tracker.reminder_engine.last_eligible = True

        result = self.tracker.skip_reminder()

        self.assertTrue(result)
        self.assertFalse(self.tracker.reminder_state.pending)
        self.assertEqual(
            self.tracker.reminder_engine.active_seconds,
            0.0,
        )
        self.assertIsNone(
            self.tracker.reminder_engine.last_monotonic
        )
        self.assertFalse(
            self.tracker.reminder_engine.last_eligible
        )

    def test_snooze_without_pending_reminder(self):
        self.assertFalse(self.tracker.snooze_reminder())

    def test_skip_without_pending_reminder(self):
        self.assertFalse(self.tracker.skip_reminder())

    def test_pending_reminder_prevents_new_notification(self):
        self.tracker.notifier = MagicMock()
        self.tracker.reminder_state.mark_due()
        self.tracker.reminder_engine.tick.return_value = True

        self.tracker.check_reminder(active=True)

        self.tracker.notifier.send_checkin_reminder.assert_not_called()

    
    def test_snoozed_reminder_reappears_when_due(self):
        self.tracker.notifier = MagicMock()
        self.tracker.notifier.send_checkin_reminder.return_value = True

        self.tracker.reminder_state.mark_due()
        self.tracker.reminder_state.snooze(
            15,
            datetime(2026, 10, 13, 10, 0),
        )

        self.tracker.current_settings.reminder_work_start = "00:00"
        self.tracker.current_settings.reminder_work_end = "23:59"

        with patch("devtrack.collector.tracker.datetime") as mock_datetime:
            mock_datetime.now.return_value = datetime(
                2026, 10, 13, 10, 15
            )
            self.tracker.check_reminder(active=True)

        self.tracker.notifier.send_checkin_reminder.assert_called_once_with(
            self.tracker.reminder_state.reminder_id
        )
        self.assertTrue(self.tracker.reminder_state.pending)
        self.assertIsNone(self.tracker.reminder_state.snoozed_until)

    def test_snoozed_reminder_does_not_appear_early(self):
        self.tracker.notifier = MagicMock()
        self.tracker.reminder_state.mark_due()
        self.tracker.reminder_state.snooze(
            15,
            datetime(2026, 10, 13, 10, 0),
        )

        with patch("devtrack.collector.tracker.datetime") as mock_datetime:
            mock_datetime.now.return_value = datetime(
                2026, 10, 13, 10, 10
            )
            self.tracker.check_reminder(active=True)

        self.tracker.notifier.send_checkin_reminder.assert_not_called()

    def test_failed_notification_does_not_stay_pending(self):
        self.tracker.notifier = MagicMock()
        self.tracker.notifier.send_checkin_reminder.return_value = False
        self.tracker.reminder_engine.tick.return_value = True

        self.tracker.check_reminder(active=True)

        self.assertFalse(self.tracker.reminder_state.pending)
        self.assertEqual(self.tracker.reminder_engine.active_seconds, 0)
        self.assertIsNone(self.tracker.reminder_engine.last_monotonic)


    
    def test_queued_snooze_action(self):
        self.tracker.reminder_action_queue = MagicMock()
        self.tracker.reminder_action_queue.consume_for_reminder.return_value = "snooze"

        self.tracker.reminder_state.mark_due()

        result_before = self.tracker.reminder_state.snoozed_until
        self.assertIsNone(result_before)

        self.tracker.process_reminder_actions()

        self.assertTrue(self.tracker.reminder_state.pending)
        self.assertIsNotNone(
            self.tracker.reminder_state.snoozed_until
        )

    def test_queued_skip_action(self):
        self.tracker.reminder_action_queue = MagicMock()
        self.tracker.reminder_action_queue.consume_for_reminder.return_value = "skip"

        self.tracker.reminder_state.mark_due()
        self.tracker.reminder_engine.active_seconds = 600

        self.tracker.process_reminder_actions()

        self.assertFalse(self.tracker.reminder_state.pending)
        self.assertEqual(
            self.tracker.reminder_engine.active_seconds,
            0.0,
        )

    
    def test_empty_action_queue(self):
        self.tracker.reminder_action_queue = MagicMock()
        self.tracker.reminder_action_queue.consume_for_reminder.return_value = None

        # Create a pending reminder before processing actions.
        self.tracker.reminder_state.mark_due()
        current_id = self.tracker.reminder_state.reminder_id

        self.tracker.process_reminder_actions()

        self.tracker.reminder_action_queue.consume_for_reminder.assert_called_once_with(
            current_id
        )

        # An empty queue must not dismiss the reminder.
        self.assertTrue(self.tracker.reminder_state.pending)


    
    def test_no_pending_reminder_does_not_consume_actions(self):
        self.tracker.reminder_action_queue = MagicMock()

        self.tracker.process_reminder_actions()

        self.tracker.reminder_action_queue.consume_for_reminder.assert_not_called()

    def test_actions_use_current_reminder_id(self):
        self.tracker.reminder_action_queue = MagicMock()
        self.tracker.reminder_action_queue.consume_for_reminder.return_value = None

        self.tracker.reminder_state.mark_due()
        current_id = self.tracker.reminder_state.reminder_id

        self.tracker.process_reminder_actions()

        self.tracker.reminder_action_queue.consume_for_reminder.assert_called_once_with(
            current_id
        )


if __name__ == "__main__":
    unittest.main()
