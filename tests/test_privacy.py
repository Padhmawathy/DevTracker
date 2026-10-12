
import unittest

from devtrack.collector.privacy import (
    sanitize_window_title,
    normalize_window_title,
)


class TestPrivacy(unittest.TestCase):

    def test_whatsapp_root_title_redacted(self):
        result = sanitize_window_title(
            "WhatsApp.Root.exe",
            "Private conversation",
        )
        self.assertEqual(result, "[REDACTED]")

    def test_sensitive_process_case_insensitive(self):
        result = sanitize_window_title(
            "OUTLOOK.EXE",
            "Confidential email",
        )
        self.assertEqual(result, "[REDACTED]")

    def test_browser_title_sanitized(self):
        result = sanitize_window_title(
            "brave.exe",
            "DevTracker documentation - Brave",
        )
        self.assertEqual(result, "DevTracker documentation")

    def test_vscode_title_normalized(self):
        result = normalize_window_title(
            "Code.exe",
            "● main.py - DevTracker",
        )
        self.assertEqual(result, "main.py - DevTracker")


if __name__ == "__main__":
    unittest.main()
