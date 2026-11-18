
"""Entry point for Windows reminder notification actions."""

import sys
from pathlib import Path


def prepare_development_imports():
    """Allow direct script execution during development.

    Packaged applications already contain the devtrack package.
    """
    if getattr(sys, "frozen", False):
        return

    project_root = Path(__file__).resolve().parent
    source_directory = project_root / "src"

    if str(source_directory) not in sys.path:
        sys.path.insert(0, str(source_directory))


prepare_development_imports()

from devtrack.reminders.action_handler import main


if __name__ == "__main__":
    raise SystemExit(main())
