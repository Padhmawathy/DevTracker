import sys

from devtrack.collector.privacy import (
    normalize_window_title,
    sanitize_window_title,
)


IGNORED_PROCESSES = {
    "lockapp.exe",
    "logonui.exe",
}


def _read_windows_foreground():
    import psutil
    import win32gui
    import win32process

    hwnd = win32gui.GetForegroundWindow()

    if not hwnd:
        return None

    window_title = win32gui.GetWindowText(hwnd)

    _, process_id = win32process.GetWindowThreadProcessId(
        hwnd
    )

    try:
        process_name = psutil.Process(process_id).name()

    except (
        psutil.NoSuchProcess,
        psutil.AccessDenied,
        psutil.ZombieProcess,
    ):
        return None

    if process_name.lower() in IGNORED_PROCESSES:
        return None

    return {
        "process_name": process_name,
        "process_id": process_id,
        "window_title": window_title,
    }


if sys.platform == "darwin":
    from devtrack.collector.macos import (
        get_active_window as _read_foreground,
    )

else:
    _read_foreground = _read_windows_foreground


def get_active_window():
    window = _read_foreground()

    if window is None:
        return None

    process_name = window["process_name"]

    window_title = sanitize_window_title(
        process_name,
        window["window_title"],
    )

    window_title = normalize_window_title(
        process_name,
        window_title,
    )

    return {**window, "window_title": window_title}
