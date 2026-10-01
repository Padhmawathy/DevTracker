import ctypes
from ctypes import wintypes


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.UINT),
        ("dwTime", wintypes.DWORD),
    ]


def get_idle_seconds():
    last_input_info = LASTINPUTINFO()
    last_input_info.cbSize = ctypes.sizeof(LASTINPUTINFO)

    if not ctypes.windll.user32.GetLastInputInfo(
        ctypes.byref(last_input_info)
    ):
        raise RuntimeError("Unable to read Windows input state")

    tick_count = ctypes.windll.kernel32.GetTickCount()

    idle_milliseconds = (
        tick_count - last_input_info.dwTime
    )

    return idle_milliseconds / 1000