import time
from datetime import datetime

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


def format_duration(seconds):
    seconds = int(seconds)

    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)

    if hours:
        return f"{hours}h {minutes}m {seconds}s"

    if minutes:
        return f"{minutes}m {seconds}s"

    return f"{seconds}s"


def watch_active_window(poll_interval=1):
    last_window = None
    current_activity = None

    print("DevTrack foreground tracker started.")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            active_window = get_active_window()

            if not active_window:
                time.sleep(poll_interval)
                continue

            current_window = (
                active_window["process_name"],
                active_window["window_title"],
            )

            if current_window != last_window:
                now = time.time()

                if current_activity:
                    duration = now - current_activity["start_timestamp"]

                    print(
                        f"[ACTIVITY END] "
                        f"{current_activity['process_name']} | "
                        f"{current_activity['window_title']} | "
                        f"{format_duration(duration)}"
                    )

                current_activity = {
                    "process_name": active_window["process_name"],
                    "process_id": active_window["process_id"],
                    "window_title": active_window["window_title"],
                    "start_timestamp": now,
                    "start_time": datetime.now(),
                }

                print(
                    f"[ACTIVITY START] "
                    f"{active_window['process_name']} | "
                    f"{active_window['window_title']} | "
                    f"{current_activity['start_time'].strftime('%H:%M:%S')}"
                )

                last_window = current_window

            time.sleep(poll_interval)

    except KeyboardInterrupt:
        if current_activity:
            end_time = time.time()
            duration = end_time - current_activity["start_timestamp"]

            print(
                f"\n[ACTIVITY END] "
                f"{current_activity['process_name']} | "
                f"{current_activity['window_title']} | "
                f"{format_duration(duration)}"
            )

        print("\nDevTrack foreground tracker stopped.")


if __name__ == "__main__":
    watch_active_window()