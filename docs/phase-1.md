# DevTrack — Phase 1: Windows Activity Collector

## Goal

Prove that DevTrack can reliably capture useful Windows activity without using invasive tracking methods such as keylogging or screenshots.

Phase 1 focuses only on activity collection and reliability.

---

## What Phase 1 Captures

DevTrack currently captures:

- Foreground application/process
- Process ID
- Active window title
- Activity start time
- Activity end time
- Activity duration
- User idle state
- Windows lock/unlock state
- Application/window switching
- Collector interruption gaps

Completed activities are stored locally in SQLite.

---

## Privacy Behaviour

DevTrack does not capture:

- Keystrokes
- Screenshots
- Message contents directly
- Clipboard contents

Sensitive applications can have their window titles redacted.

Examples include:

- Outlook
- Microsoft Teams
- WhatsApp
- Telegram

Browser names are normalized from window titles, and Windows lock-screen processes are ignored.

---

## Noise Filtering

Very short foreground activities are ignored.

Current minimum activity duration:

`2 seconds`

This prevents accidental or extremely short window switches from polluting the activity timeline.

---

## Idle Detection

DevTrack treats the user as idle after:

`300 seconds / 5 minutes`

When idle begins, the current activity is closed.

When the user becomes active again, DevTrack begins a new activity session.

---

## Windows Session Handling

DevTrack detects Windows workstation lock and unlock states.

When Windows locks:

1. The current activity is closed.
2. Lock-screen processes are ignored.
3. No normal work activity is recorded while the workstation is locked.
4. A new activity session begins after unlock.

Lock/unlock detection includes debounce logic to prevent duplicate state changes during Windows session transitions.

---

## Sleep / Suspension Handling

DevTrack includes polling-gap detection using both:

- `time.monotonic()`
- Wall-clock timestamps

However, Windows sleep behaviour can vary depending on the device and Windows power mode.

On the current development machine, Windows lock/session detection appears to provide the primary protection against sleep time being counted as active work.

Polling-gap detection remains as a fallback.

This should be revisited during later reliability testing and packaging.

---

## Window Normalization

DevTrack normalizes certain window-title changes that do not represent meaningful activity changes.

Example:

`● tracker.py - DevTracker - Visual Studio Code`

and

`tracker.py - DevTracker - Visual Studio Code`

are treated as the same logical window.

The VS Code `●` marker only represents unsaved changes and should not create a new activity session.

Browser suffixes such as:

`- Google Chrome`

`- Brave`

are also removed.

---

## Local Storage

Activity records are currently persisted using SQLite:

`data/devtrack.db`

Example activity structure:

```json
{
  "process_name": "Code.exe",
  "process_id": 12345,
  "window_title": "tracker.py - DevTracker - Visual Studio Code",
  "started_at": "2026-10-06T11:30:00",
  "ended_at": "2026-10-06T11:32:30",
  "duration_seconds": 150
}
```

The database is excluded from Git to avoid committing personal activity data.

---

## Phase 1 Manual Test Checklist

### Foreground Detection

PASS if switching between VS Code, Chrome, Terminal and Explorer produces the correct application.

### Window Switching

PASS if changing files or browser tabs creates appropriate activity transitions.

### Duration Tracking

PASS if recorded durations approximately match actual foreground usage.

### Short Activity Filtering

PASS if approximately one-second accidental switches show:

`[IGNORED SHORT ACTIVITY]`

and are not stored.

### Idle Detection

PASS if an activity closes when the user remains inactive beyond the configured threshold.

### Lock / Unlock

PASS if one lock and one unlock event are detected without duplicate transitions.

### Lock Screen Filtering

PASS if `LockApp.exe` and `LogonUI.exe` are not stored as work activity.

### Privacy Filtering

PASS if sensitive applications store `[REDACTED]` instead of potentially private window titles.

### Window Normalization

PASS if VS Code unsaved markers do not create fake activity changes.

### Persistence

PASS if activity remains available in SQLite after DevTrack is stopped and restarted.

---

## Phase 1 Result

The core Windows activity collector is functional.

DevTrack can now answer:

- Which application was active?
- Which meaningful window was active?
- When did the activity begin?
- When did it end?
- How long was it active?
- Was the computer idle or locked?
- Should the event be ignored for privacy or noise reasons?

This establishes the base required for building the developer work timeline.

---

## Known Limitations

Sleep and Modern Standby behaviour varies across Windows devices.

Window titles provide useful context but do not always reveal what development task the user was actually performing.

Application activity alone cannot determine whether an activity represents:

- Coding
- Testing
- Research
- Debugging
- Requirements analysis
- Communication
- Entertainment
- Other work

That higher-level understanding belongs to later DevTrack phases.

---

## Phase Status

**Phase 1 — Windows Activity Collector: COMPLETE**

Next:

**Phase 2 — Activity Storage & Data Layer**