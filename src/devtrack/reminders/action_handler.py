
import re
import sys
from urllib.parse import urlsplit

from devtrack.reminders.action_queue import ReminderActionQueue


def parse_action_uri(uri: str) -> tuple[str, str]:
    """Validate a Windows notification action link."""
    if not isinstance(uri, str):
        raise ValueError("Invalid action URI")

    parsed = urlsplit(uri)

    if parsed.scheme != "devtracker-reminder":
        raise ValueError("Invalid action protocol")

    if parsed.netloc not in ("snooze", "skip"):
        raise ValueError("Invalid reminder action")

    if parsed.query or parsed.fragment:
        raise ValueError("Unexpected URI parameters")

    reminder_id = parsed.path.removeprefix("/")

    if re.fullmatch(r"[0-9a-f]{32}", reminder_id) is None:
        raise ValueError("Invalid reminder ID")

    return parsed.netloc, reminder_id


def handle_action_uri(
    uri: str,
    queue: ReminderActionQueue | None = None,
) -> None:
    """Queue an action without directly changing collector state."""
    action, reminder_id = parse_action_uri(uri)

    if queue is None:
        queue = ReminderActionQueue()

    queue.enqueue(action, reminder_id)


def main() -> int:
    if len(sys.argv) != 2:
        print("Expected one notification action URI")
        return 1

    try:
        handle_action_uri(sys.argv[1])
    except (ValueError, OSError) as exc:
        print(f"[REMINDER ACTION ERROR] {exc}")
        return 1

    print("[REMINDER ACTION] Queued successfully")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
