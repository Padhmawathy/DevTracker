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
    ]

    for separator in separators:
        if separator in title:
            title = title.replace(separator, "")

    return title.strip()