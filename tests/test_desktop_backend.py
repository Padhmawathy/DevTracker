
import unittest
from unittest.mock import MagicMock, patch

from devtrack.desktop_backend import run_backend


class TestDesktopBackend(unittest.TestCase):

    def test_backend_starts_and_stops_collector(self):
        tracker = MagicMock()
        server = MagicMock()

        run_backend(
            tracker=tracker,
            server=server,
        )

        tracker.run.assert_called_once()
        tracker.stop.assert_called_once()
        server.run.assert_called_once()

    def test_collector_stops_if_server_fails(self):
        tracker = MagicMock()
        server = MagicMock()
        server.run.side_effect = RuntimeError("Server failed")

        with self.assertRaisesRegex(
            RuntimeError,
            "Server failed",
        ):
            run_backend(
                tracker=tracker,
                server=server,
            )

        tracker.stop.assert_called_once()

    def test_ctrl_c_stops_backend_cleanly(self):
        tracker = MagicMock()
        server = MagicMock()

        server.run.side_effect = KeyboardInterrupt()

        run_backend(
            tracker=tracker,
            server=server,
        )

        tracker.stop.assert_called_once()
        server.run.assert_called_once()
if __name__ == "__main__":
    unittest.main()
