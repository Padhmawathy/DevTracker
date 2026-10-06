import psutil
import win32gui
import win32process

from devtrack.collector.privacy import (
    normalize_window_title,
    sanitize_window_title,
)


IGNORED_PROCESSES = {
    "lockapp.exe",
    "logonui.exe",
}


def get_active_window():
    hwnd = win32gui.GetForegroundWindow()

    if not hwnd:
        return None

    window_title = win32gui.GetWindowText(hwnd)

    _, process_id = win32process.GetWindowThreadProcessId(
        hwnd
    )

    try:
        process = psutil.Process(process_id)

        process_name = process.name()

        if process_name.lower() in IGNORED_PROCESSES:
            return None

        window_title = sanitize_window_title(
            process_name,
            window_title,
        )

        window_title = normalize_window_title(
            process_name,
            window_title,
        )

        return {
            "process_name": process_name,
            "process_id": process_id,
            "window_title": window_title,
        }

    except (
        psutil.NoSuchProcess,
        psutil.AccessDenied,
        psutil.ZombieProcess,
    ):
        return None