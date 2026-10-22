
import unittest
from unittest.mock import MagicMock, patch
from io import StringIO
from devtrack.desktop_backend import run_backend, listen_for_shutdown


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


    def test_managed_shutdown_command(self):
        server = MagicMock()
        server.should_exit = False

        input_stream = StringIO("shutdown\n")

        listen_for_shutdown(server, input_stream)

        self.assertTrue(server.should_exit)

    def test_managed_shutdown_on_closed_input(self):
        server = MagicMock()
        server.should_exit = False

        input_stream = StringIO("")

        listen_for_shutdown(server, input_stream)

        self.assertTrue(server.should_exit)

if __name__ == "__main__":
    unittest.main()
