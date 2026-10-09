# DevTracker — Automatic Work Journal for Developers

DevTracker is a personal portfolio project that aims to turn everyday development activity into a useful, privacy-conscious work journal. Rather than simply reporting how long an application was open, the long-term goal is to help developers recall **what they worked on, what they discovered, what blocked them, and what comes next**.

> **Project status:** Phase 1 and Phase 2 completed. Phase 3 (Developer Work Check-ins) is next.

## Why DevTracker?

A developer's day involves coding, testing, debugging, research, requirements, and discussions. Reconstructing all of that at the end of the day can be difficult. DevTracker starts by capturing basic Windows application activity and building a reliable, queryable history; future phases will add developer-supplied context and structured reports.

## Implemented features

### Phase 1 — Windows Activity Collector ✅

- Detects the foreground Windows application and window.
- Tracks application activity durations and user idle periods.
- Handles Windows lock/unlock and session boundaries.
- Filters short/noisy activity and normalizes window titles.
- Applies privacy-aware filtering to captured window information.
- Persists completed activity records locally in SQLite.

### Phase 2 — Activity Storage & Data Layer ✅

- SQLite-backed activity persistence and retrieval.
- Activity history, date-range queries, and application-based filtering.
- Application usage aggregation and daily activity summaries.
- Chronological daily timelines with grouping of consecutive application sessions.
- Small-gap tolerance for grouping, without adding gap time to tracked duration.
- Command-line daily timeline view with readable times, durations, activity count, and total tracked time.
- **16 passing automated unit tests** covering storage, boundaries, summaries, grouping, and timeline service behavior.

During a live test, grouping reduced **14 raw activity entries to 8 timeline entries** while preserving the same **2 minutes 23 seconds** of tracked activity. This is one test observation, not a benchmark.

## Technology

- **Python** — collector, services, and CLI
- **SQLite** — local activity database
- **unittest** — automated tests
- **Git** — incremental feature and milestone history
- **Windows** — current collection target

## Getting started (Windows CMD)

Clone the repository and open the project directory:

```cmd
 git clone https://github.com/Padhmawathy/DevTracker.git
 cd DevTracker
```

Create and activate a virtual environment:

```cmd
python -m venv .venv
.venv\Scripts\activate
set PYTHONPATH=src
```

> The project currently uses a `src` layout without a configured package installation. Set `PYTHONPATH=src` in each new CMD session before running the modules.

### Collect activity

```cmd
python -m devtrack.main
```

The collector runs in the foreground. Use Windows applications to generate activity, then stop the collector with **Ctrl+C**. Completed activity records are stored locally in `data/devtrack.db` by default.

### View the daily timeline

```cmd
python -m devtrack.cli
```

Example format (illustrative):

```text
DevTrack — Daily Timeline
2026-10-09
--------------------------------------------------
12:33:05 - 12:33:32 | 27s | Code.exe
12:33:32 - 12:34:10 | 38s | brave.exe
--------------------------------------------------
Total activities: 2
Total tracked time: 0h 1m 5s
```

If no completed activity was recorded for the current day, the CLI displays `No activity recorded today.`

### Run tests

```cmd
set PYTHONPATH=src
python -m unittest discover -s tests -v
```

The Phase 2 release was validated with **16 passing tests**.

## Privacy by design

DevTracker is intended as a personal developer journal, **not invasive employee monitoring software**. Its design avoids keystroke logging, screenshots, and private-message capture by default. It focuses on application activity, appropriately filtered window information, active/idle time, and eventually user-confirmed work context.

**Note:** Window titles may contain sensitive information. Review the filtering rules and local database before sharing logs or screenshots. The project is still under development and has not undergone a formal security audit.

## Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Windows Activity Collector | ✅ Complete |
| 2 | Activity Storage & Data Layer | ✅ Complete |
| 3 | Periodic Developer Work Check-ins | ⏭ Next |
| 4 | Developer Timeline & Dashboard | Planned (basic CLI timeline already available) |
| 5 | Requirements, Bugs & Testing Context | Planned |
| 6 | Daily Work Reports | Planned |
| 7 | AI-assisted Summaries | Planned |
| 8 | Packaging, Polish & Deployment | Planned |

A future developer-context workflow may follow:

**Requirement → Understanding → Assumptions → Questions → Work → Testing → Bugs → Result**

## Milestones

- `v0.1-phase1` — Windows Activity Collector
- `v0.2-phase2` — Activity Storage & Data Layer, timeline CLI, and automated tests

## Development approach

DevTracker is being built incrementally, with features, fixes, tests, and milestones tracked in Git. The immediate next milestone is adding short, periodic check-ins so the journal can capture **what the developer was doing**, not only **which application was active**.

---

**DevTracker — Automatic Work Journal for Developers**



## Phase 3 — Developer Check-ins & Daily Journal

Phase 3 adds developer-provided work context to DevTracker's automatic activity tracking.

### Features

- Manual developer check-ins
- Project names and work descriptions
- Work categories (Coding, Debugging, Testing, Research, Other)
- Optional blockers
- SQLite persistence for check-ins
- Configurable periodic terminal reminders
- Daily work journal combining application activity and developer check-ins
- Date-based journal viewing

### Usage

Run the following commands from the project root.

**1. Record a developer check-in**

```cmd
python -m devtrack.checkin_cli
```

**2. Start periodic reminders**

```cmd
python -m devtrack.reminder_cli --interval 60
```

Reminders run in the terminal while the process is active. Press Ctrl+C to stop.

**3. View today's work journal**

```cmd
python -m devtrack.journal_cli
```

**4. View a specific day's journal**

```cmd
python -m devtrack.journal_cli --date 2026-10-09
```

**5. Run automated tests**

```cmd
python -m unittest discover -s tests -v
```

### Privacy

DevTracker stores activity metadata and developer-entered check-ins locally in SQLite.

Developer check-ins are entered manually. The reminder service does not automatically read source code, messages, or typed text.

### Current Limitations

- Reminders are terminal-based, not Windows desktop notifications.
- The reminder process must be started manually.
- Snooze prompts can block the reminder loop until answered.
- Daily journals are currently displayed in the terminal.
- Work descriptions are not automatically inferred from application activity.
