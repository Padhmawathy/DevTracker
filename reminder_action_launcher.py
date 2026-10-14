
import os
import sys
from pathlib import Path

# Find the project folder, regardless of where Windows
# starts this script.
PROJECT_ROOT = Path(__file__).resolve().parent

# Ensure DevTracker's source package can be imported.
sys.path.insert(
    0,
    str(PROJECT_ROOT / "src"),
)

# Ensure the SQLite queue uses the project's data folder.
os.chdir(PROJECT_ROOT)

from devtrack.reminders.action_handler import main


if __name__ == "__main__":
    raise SystemExit(main())
