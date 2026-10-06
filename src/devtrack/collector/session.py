import ctypes
from ctypes import wintypes


DESKTOP_SWITCHDESKTOP = 0x0100

user32 = ctypes.WinDLL(
    "user32",
    use_last_error=True,
)

user32.OpenInputDesktop.argtypes = [
    wintypes.DWORD,
    wintypes.BOOL,
    wintypes.DWORD,
]

user32.OpenInputDesktop.restype = wintypes.HANDLE

user32.SwitchDesktop.argtypes = [
    wintypes.HANDLE,
]

user32.SwitchDesktop.restype = wintypes.BOOL

user32.CloseDesktop.argtypes = [
    wintypes.HANDLE,
]

user32.CloseDesktop.restype = wintypes.BOOL


def is_workstation_locked():
    """
    Return True when the normal Windows desktop
    is not currently available to the user.
    """

    desktop = user32.OpenInputDesktop(
        0,
        False,
        DESKTOP_SWITCHDESKTOP,
    )

    if not desktop:
        return True

    try:
        return not bool(
            user32.SwitchDesktop(desktop)
        )

    finally:
        user32.CloseDesktop(desktop)