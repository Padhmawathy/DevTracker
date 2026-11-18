
import os
import sys
from pathlib import Path


APP_NAME = "DevTrack"


def is_packaged() -> bool:
    """Check whether DevTrack is running as a packaged executable."""
    return bool(getattr(sys, "frozen", False))


def get_data_directory() -> Path:
    """Return the writable directory for application data."""

    if is_packaged():
        local_app_data = os.environ.get("LOCALAPPDATA")

        if not local_app_data:
            raise RuntimeError(
                "LOCALAPPDATA is unavailable."
            )

        return Path(local_app_data) / APP_NAME

    # Preserve the existing data folder while developing.
    return Path(__file__).resolve().parents[3] / "data"


def get_data_path(filename: str) -> Path:
    """Return a path inside DevTrack's private data directory."""
    if (
        not filename
        or Path(filename).name != filename
        or filename in {".", ".."}
        or "/" in filename
        or "\\" in filename
    ):
        raise ValueError("Expected a simple data filename")

    return get_data_directory() / filename
