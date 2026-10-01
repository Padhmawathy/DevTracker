import time

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

    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return None


def watch_active_window(poll_interval=1):
    last_window = None

    print("DevTrack foreground tracker started.")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            active_window = get_active_window()

            if active_window:
                current_window = (
                    active_window["process_name"],
                    active_window["window_title"],
                )

                if current_window != last_window:
                    print(
                        f"[APP SWITCH] "
                        f"{active_window['process_name']} | "
                        f"{active_window['window_title']}"
                    )

                    last_window = current_window

            time.sleep(poll_interval)

    except KeyboardInterrupt:
        print("\nDevTrack foreground tracker stopped.")


if __name__ == "__main__":
    watch_active_window()