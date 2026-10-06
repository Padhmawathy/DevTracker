SENSITIVE_PROCESSES = {
    "outlook.exe",
    "teams.exe",
    "whatsapp.exe",
    "telegram.exe",
}

BROWSER_PROCESSES = {
    "chrome.exe",
    "msedge.exe",
    "firefox.exe",
    "brave.exe",
}


def sanitize_window_title(process_name: str, window_title: str) -> str:
    process_name = process_name.lower()

    if process_name in SENSITIVE_PROCESSES:
        return "[REDACTED]"

    if process_name in BROWSER_PROCESSES:
        return sanitize_browser_title(window_title)

    return window_title

def sanitize_browser_title(title: str) -> str:
    if not title:
        return ""

    separators = [
        " - Google Chrome",
        " - Microsoft Edge",
        " — Mozilla Firefox",
        " - Mozilla Firefox",
        " - Brave",
    ]

    for separator in separators:
        if title.endswith(separator):
            title = title[:-len(separator)]
            break

    return title.strip()
def normalize_window_title(process_name: str, title: str) -> str:
    if not title:
        return ""

    process_name = process_name.lower()

    # VS Code adds this marker when a file has unsaved changes.
    if process_name == "code.exe":
        title = title.lstrip("● ").strip()

    return title