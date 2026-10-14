
import sys
import winreg
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent

PYTHONW = PROJECT_ROOT / ".venv" / "Scripts" / "pythonw.exe"
LAUNCHER = PROJECT_ROOT / "reminder_action_launcher.py"

PROTOCOL_KEY = (
    r"Software\Classes\devtracker-reminder"
)


def main():
    if not PYTHONW.is_file():
        raise FileNotFoundError(
            f"Python executable not found: {PYTHONW}"
        )

    if not LAUNCHER.is_file():
        raise FileNotFoundError(
            f"Action launcher not found: {LAUNCHER}"
        )

    command = f'"{PYTHONW}" "{LAUNCHER}" "%1"'

    with winreg.CreateKey(
        winreg.HKEY_CURRENT_USER,
        PROTOCOL_KEY,
    ) as key:
        winreg.SetValueEx(
            key, "",
            0,
            winreg.REG_SZ,
            "URL:DevTracker Reminder Protocol",
        )

        winreg.SetValueEx(
            key,
            "URL Protocol",
            0,
            winreg.REG_SZ,
            "",
        )

    with winreg.CreateKey(
        winreg.HKEY_CURRENT_USER,
        PROTOCOL_KEY + r"\shell\open\command",
    ) as key:
        winreg.SetValueEx(
            key,
            "",
            0,
            winreg.REG_SZ,
            command,
        )

    print("DevTracker reminder protocol registered.")
    print(f"Command: {command}")


if __name__ == "__main__":
    main()
