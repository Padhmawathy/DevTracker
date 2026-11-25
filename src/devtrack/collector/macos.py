"""macOS versions of the collector's system probes.

All three read Quartz (CoreGraphics) only, so they work from a background
process with no Cocoa run loop. NSWorkspace.frontmostApplication would go
stale there, which is why the frontmost window comes from the window list.

Window titles need the Screen Recording permission (System Settings >
Privacy & Security > Screen Recording > DevTrack). Without it macOS hides
other apps' titles and DevTrack records the app name alone.
"""

import Quartz


IGNORED_OWNERS = {
    "loginwindow",
    "screensaverengine",
    "window server",
    "dock",
}


def get_active_window():
    windows = Quartz.CGWindowListCopyWindowInfo(
        Quartz.kCGWindowListOptionOnScreenOnly
        | Quartz.kCGWindowListExcludeDesktopElements,
        Quartz.kCGNullWindowID,
    )

    # The list runs front to back; layer 0 holds normal app windows,
    # higher layers hold the menu bar, Dock and overlays.
    for window in windows or ():
        if window.get(Quartz.kCGWindowLayer, 1) != 0:
            continue

        owner = window.get(Quartz.kCGWindowOwnerName) or ""
        process_id = window.get(Quartz.kCGWindowOwnerPID)

        if not owner or process_id is None:
            continue

        if owner.lower() in IGNORED_OWNERS:
            return None

        return {
            "process_name": owner,
            "process_id": int(process_id),
            "window_title": window.get(Quartz.kCGWindowName) or "",
        }

    return None


def get_idle_seconds():
    return Quartz.CGEventSourceSecondsSinceLastEventType(
        Quartz.kCGEventSourceStateHIDSystemState,
        Quartz.kCGAnyInputEventType,
    )


def is_workstation_locked():
    session = Quartz.CGSessionCopyCurrentDictionary()

    # No session dictionary means no logged-in console user (e.g. at the
    # login window or during fast user switching).
    if not session:
        return True

    if session.get("CGSSessionScreenIsLocked"):
        return True

    return not session.get("kCGSSessionOnConsoleKey", True)
