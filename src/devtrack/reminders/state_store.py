
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
from uuid import UUID, uuid4
from devtrack.reminders.state import ReminderState


class JSONReminderStateStore:
    """Persist a snoozed reminder across collector restarts."""

    def __init__(self, path="data/reminder_state.json"):
        self.path = Path(path)

    def save(self, state: ReminderState):
        self.path.parent.mkdir(
            parents=True,
            exist_ok=True,
        )

        data = {
            "pending": state.pending,
            "snoozed_until": (
                state.snoozed_until.isoformat()
                if state.snoozed_until
                else None
            ),
            "reminder_id": state.reminder_id,
        }

        # Write a temporary file and replace the original.
        # This reduces the risk of incomplete JSON writes.
        temporary_path = None

        try:
            with NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=self.path.parent,
                suffix=".tmp",
                delete=False,
            ) as file:
                temporary_path = Path(file.name)
                json.dump(data, file, indent=2)

            os.replace(temporary_path, self.path)

        finally:
            if temporary_path is not None:
                temporary_path.unlink(missing_ok=True)

    def load(self) -> ReminderState:
        from datetime import datetime

        if not self.path.exists():
            return ReminderState()

        with self.path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        if not isinstance(data, dict):
            raise ValueError("Invalid reminder state file")

        pending = data.get("pending", False)
        snoozed_until = data.get("snoozed_until")
        reminder_id = data.get("reminder_id")
        if type(pending) is not bool:
            raise ValueError("Invalid pending reminder value")
        if reminder_id is not None:
            if not isinstance(reminder_id, str):
                raise ValueError("Invalid reminder ID")

            try:
                parsed_id = UUID(hex=reminder_id)
            except (ValueError, AttributeError) as exc:
                raise ValueError("Invalid reminder ID") from exc

            if parsed_id.hex != reminder_id:
                raise ValueError("Invalid reminder ID")

        if snoozed_until is not None:
            if not isinstance(snoozed_until, str):
                raise ValueError("Invalid snooze deadline")

            snoozed_until = datetime.fromisoformat(
                snoozed_until
            )

            if snoozed_until.tzinfo is not None:
                raise ValueError(
                    "Reminder deadline must use local time"
                )

        if not pending and snoozed_until is not None:
            raise ValueError(
                "Cannot snooze a non-pending reminder"
            )

        # An ordinary pending notification should not
        # block the collector forever after a restart.
        # Preserve only reminders that were snoozed.
        if snoozed_until is None:
            return ReminderState()

        return ReminderState(
            pending=True,
            snoozed_until=snoozed_until,
            reminder_id=reminder_id or uuid4().hex,
        )
