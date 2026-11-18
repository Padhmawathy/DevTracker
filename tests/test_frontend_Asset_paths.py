
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from devtrack.api.main import get_frontend_dist


class TestFrontendAssetPaths(unittest.TestCase):

    def test_development_frontend_path(self):
        with patch.object(sys, "frozen", False, create=True):
            path = get_frontend_dist()

        self.assertEqual(path.name, "dist")
        self.assertEqual(path.parent.name, "frontend")

    def test_packaged_frontend_path(self):
        with patch.object(sys, "frozen", True, create=True):
            with patch.object(
                sys,
                "_MEIPASS",
                r"C:\DevTrackBundle",
                create=True,
            ):
                path = get_frontend_dist()

        self.assertEqual(
            path,
            Path(r"C:\DevTrackBundle") / "frontend" / "dist",
        )


if __name__ == "__main__":
    unittest.main()
