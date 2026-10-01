import psutil
import win32gui
import win32process


def get_active_window():
    hwnd = win32gui.GetForegroundWindow()

    if not hwnd:
        return None

    window_title = win32gui.GetWindowText(hwnd)

    _, process_id = win32process.GetWindowThreadProcessId(hwnd)

    try:
        process = psutil.Process(process_id)

        return {
            "process_name": process.name(),
            "process_id": process_id,
            "window_title": window_title,
        }

    except (
        psutil.NoSuchProcess,
        psutil.AccessDenied,
    ):
        return None