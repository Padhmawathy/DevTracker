// Run with: npm run test:mobile   (Node's built-in test runner, no extra packages)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyStore,
  handleLocalRequest,
  normalizeStore,
  type StoreData,
} from "../src/services/localStore.ts";

const NOW = new Date(2026, 10, 18, 9, 30, 0);

function call(data: StoreData, method: string, path: string, body?: unknown, now = NOW) {
  return handleLocalRequest(data, { method, path, body }, now);
}

function task(overrides: Record<string, unknown> = {}) {
  return { title: "Task", notes: null, due_date: null, priority: "none", status: "todo", job_id: null, ...overrides };
}

function job(overrides: Record<string, unknown> = {}) {
  return { name: "Acme", client: null, color: "#0A84FF", emoji: null, status: "active", ...overrides };
}

test("creates and lists a task with the desktop's shape", () => {
  const data = emptyStore();
  const res = call(data, "POST", "/api/tasks", task({ title: "  Write intro  ", notes: "  " }));
  assert.equal(res.status, 201);
  assert.equal(res.changed, true);
  const t = res.body as Record<string, unknown>;
  assert.equal(t.id, 1);
  assert.equal(t.title, "Write intro");
  assert.equal(t.notes, null);
  assert.equal(t.created_at, "2026-11-18T09:30:00.000000");
  assert.equal(t.completed_at, null);
  assert.equal(t.job_name, null);

  const list = call(data, "GET", "/api/tasks");
  assert.equal(list.changed, false);
  assert.equal((list.body as { tasks: unknown[] }).tasks.length, 1);
});

test("orders tasks like the desktop", () => {
  const data = emptyStore();
  call(data, "POST", "/api/tasks", task({ title: "no date low", priority: "low" }));
  call(data, "POST", "/api/tasks", task({ title: "later", due_date: "2026-11-25" }));
  call(data, "POST", "/api/tasks", task({ title: "soon medium", due_date: "2026-11-19", priority: "medium" }));
  call(data, "POST", "/api/tasks", task({ title: "soon high", due_date: "2026-11-19", priority: "high" }));
  call(data, "POST", "/api/tasks", task({ title: "done early", status: "done" }), new Date(2026, 10, 1));
  call(data, "POST", "/api/tasks", task({ title: "done late", status: "done" }), new Date(2026, 10, 10));
  call(data, "POST", "/api/tasks", task({ title: "no date high", priority: "high" }));

  const titles = (call(data, "GET", "/api/tasks").body as { tasks: { title: string }[] }).tasks.map((t) => t.title);
  assert.deepEqual(titles, [
    "soon high", "soon medium", "later", "no date high", "no date low", "done late", "done early",
  ]);
});

test("keeps the original completion time when a done task is edited", () => {
  const data = emptyStore();
  call(data, "POST", "/api/tasks", task());
  call(data, "PUT", "/api/tasks/1", task({ status: "done" }), new Date(2026, 10, 18, 10));
  const edited = call(data, "PUT", "/api/tasks/1", task({ status: "done", title: "Renamed" }), new Date(2026, 10, 18, 12));
  assert.equal((edited.body as { completed_at: string }).completed_at, "2026-11-18T10:00:00.000000");
  const reopened = call(data, "PUT", "/api/tasks/1", task({ status: "todo" }));
  assert.equal((reopened.body as { completed_at: string | null }).completed_at, null);
});

test("validates tasks and leaves data untouched on error", () => {
  const data = emptyStore();
  assert.equal(call(data, "POST", "/api/tasks", task({ title: " " })).status, 422);
  assert.equal(call(data, "POST", "/api/tasks", task({ due_date: "2026-02-30" })).status, 422);
  assert.equal(call(data, "POST", "/api/tasks", task({ priority: "urgent" })).status, 422);
  assert.equal(call(data, "POST", "/api/tasks", task({ job_id: 9 })).status, 404);
  assert.equal(call(data, "PUT", "/api/tasks/5", task()).status, 404);
  assert.equal(call(data, "POST", "/api/tasks/5/delete", {}).status, 404);
  assert.equal(data.tasks.length, 0);
  assert.equal(data.next_id.tasks, 1);
});

test("deletes a task", () => {
  const data = emptyStore();
  call(data, "POST", "/api/tasks", task());
  const res = call(data, "POST", "/api/tasks/1/delete", {});
  assert.equal(res.status, 200);
  assert.equal(data.tasks.length, 0);
});

test("jobs: emoji, colour, duplicate names, totals and joins", () => {
  const data = emptyStore();
  const created = call(data, "POST", "/api/jobs", job({ emoji: " 🐱 " }));
  assert.equal(created.status, 201);
  assert.deepEqual(
    { color: (created.body as { color: string }).color, emoji: (created.body as { emoji: string }).emoji },
    { color: "#0a84ff", emoji: "🐱" },
  );
  assert.equal(call(data, "POST", "/api/jobs", job({ name: "acme" })).status, 409);
  assert.equal(call(data, "POST", "/api/jobs", job({ name: "B", emoji: "abc" })).status, 422);
  assert.equal(call(data, "POST", "/api/jobs", job({ name: "B", color: "blue" })).status, 422);

  call(data, "POST", "/api/work-entries", { job_id: 1, entry_date: "2026-11-18", hours: 2.5, description: "Build", status: "done", platform: null, link: null });
  call(data, "POST", "/api/work-entries", { job_id: 1, entry_date: "2026-11-20", hours: 1, description: "Post", status: "planned", platform: "linkedin", link: "https://example.com/p" });
  call(data, "POST", "/api/tasks", task({ job_id: 1 }));

  const [j] = (call(data, "GET", "/api/jobs").body as { jobs: Record<string, unknown>[] }).jobs;
  assert.equal(j.done_hours, 2.5);
  assert.equal(j.planned_hours, 1);
  assert.equal(j.entry_count, 2);
  assert.equal(j.post_count, 1);
  assert.equal(j.last_entry_date, "2026-11-20");

  const [t] = (call(data, "GET", "/api/tasks").body as { tasks: Record<string, unknown>[] }).tasks;
  assert.equal(t.job_name, "Acme");
  assert.equal(t.job_emoji, "🐱");

  // Switching to a colour clears the emoji, and joins follow.
  call(data, "PUT", "/api/jobs/1", job({ emoji: null, color: "#30d158", status: "archived" }));
  const [e] = (call(data, "GET", "/api/work-entries?start=2026-11-01&end=2026-11-30").body as { entries: Record<string, unknown>[] }).entries;
  assert.equal(e.job_emoji, null);
  assert.equal(e.job_color, "#30d158");
  assert.equal((call(data, "GET", "/api/jobs?include_archived=false").body as { jobs: unknown[] }).jobs.length, 0);
});

test("work entries: range, validation, update and delete", () => {
  const data = emptyStore();
  call(data, "POST", "/api/jobs", job());
  const base = { job_id: 1, entry_date: "2026-11-18", hours: null, description: "Draft", status: "done", platform: null, link: null };
  assert.equal(call(data, "POST", "/api/work-entries", { ...base, hours: 25 }).status, 422);
  assert.equal(call(data, "POST", "/api/work-entries", { ...base, link: "ftp://x" }).status, 422);
  assert.equal(call(data, "POST", "/api/work-entries", { ...base, platform: "tiktok" }).status, 422);
  assert.equal(call(data, "POST", "/api/work-entries", { ...base, job_id: 7 }).status, 404);
  call(data, "POST", "/api/work-entries", base);
  call(data, "POST", "/api/work-entries", { ...base, entry_date: "2026-12-02" });

  const nov = (call(data, "GET", "/api/work-entries?start=2026-11-01&end=2026-11-30").body as { entries: unknown[] }).entries;
  assert.equal(nov.length, 1);

  const upd = call(data, "PUT", "/api/work-entries/1", { ...base, description: "Final", hours: 1.234 });
  assert.equal((upd.body as { hours: number }).hours, 1.23);
  assert.equal(call(data, "POST", "/api/work-entries/1/delete", {}).status, 200);
  assert.equal(call(data, "POST", "/api/work-entries/1/delete", {}).status, 404);
});

test("check-ins are grouped by local day", () => {
  const data = emptyStore();
  call(data, "POST", "/api/checkins", { project_name: "Site", work_description: "Hero", category: "", blocker: "  " }, new Date(2026, 10, 18, 23, 59));
  call(data, "POST", "/api/checkins", { project_name: "Site", work_description: "Footer", category: "Coding", blocker: null }, new Date(2026, 10, 19, 0, 1));
  assert.equal(call(data, "POST", "/api/checkins", { project_name: "", work_description: "x" }).status, 422);

  const day = call(data, "GET", "/api/checkins/2026-11-18").body as { checkins: Record<string, unknown>[]; total_checkins: number };
  assert.equal(day.total_checkins, 1);
  assert.equal(day.checkins[0].category, "Other");
  assert.equal(day.checkins[0].blocker, null);
  assert.equal(call(data, "GET", "/api/checkins/nope").status, 400);
});

test("unknown routes answer 404 without changing data", () => {
  const data = emptyStore();
  const res = call(data, "GET", "/api/summary/today");
  assert.equal(res.status, 404);
  assert.equal(res.changed, false);
});

test("normalizeStore repairs missing fields and never reuses ids", () => {
  const data = normalizeStore({ tasks: [{ id: 7, title: "x" }], next_id: { tasks: 2 } });
  assert.equal(data.next_id.tasks, 8);
  assert.deepEqual(data.jobs, []);
  assert.deepEqual(normalizeStore("garbage"), emptyStore());
});

test("notes: create, order pinned first then newest, edit, delete", () => {
  const data = emptyStore();
  const note = (o: Record<string, unknown> = {}) => ({ title: "", body: "", pinned: false, color: "none", ...o });
  assert.equal(call(data, "POST", "/api/notes", note({ body: "   " })).status, 422);
  assert.equal(call(data, "POST", "/api/notes", note({ body: "x", color: "red" })).status, 422);

  call(data, "POST", "/api/notes", note({ title: "Groceries", body: "Milk\nEggs\n\n" }), new Date(2026, 10, 18, 8));
  call(data, "POST", "/api/notes", note({ body: "Idea" }), new Date(2026, 10, 18, 9));
  call(data, "POST", "/api/notes", note({ title: "Wifi", pinned: true }), new Date(2026, 10, 18, 7));

  const titles = () => (call(data, "GET", "/api/notes").body as { notes: { id: number }[] }).notes.map((n) => n.id);
  assert.deepEqual(titles(), [3, 2, 1]);
  assert.equal(data.notes[0].body, "Milk\nEggs");

  const edited = call(data, "PUT", "/api/notes/1", note({ title: "Groceries", body: "Milk", color: "yellow" }), new Date(2026, 10, 18, 10));
  assert.equal((edited.body as { color: string }).color, "yellow");
  assert.equal((edited.body as { created_at: string }).created_at, "2026-11-18T08:00:00.000000");
  assert.deepEqual(titles(), [3, 1, 2]);

  assert.equal(call(data, "POST", "/api/notes/2/delete", {}).status, 200);
  assert.equal(call(data, "PUT", "/api/notes/2", note({ body: "x" })).status, 404);
  assert.equal(normalizeStore({ notes: [{ id: 4 }] }).next_id.notes, 5);
});

test("profile: saves a trimmed name and keeps it in old backups", () => {
  const data = emptyStore();
  assert.equal((call(data, "GET", "/api/profile").body as { display_name: string }).display_name, "");
  const res = call(data, "PUT", "/api/profile", { display_name: "  Sam  " });
  assert.equal(res.changed, true);
  assert.equal((res.body as { display_name: string }).display_name, "Sam");
  assert.equal(call(data, "PUT", "/api/profile", { display_name: "x".repeat(61) }).status, 422);
  assert.equal(normalizeStore({}).profile.display_name, "");
  assert.equal(normalizeStore({ profile: { display_name: "A" } }).profile.daily_focus_goal_minutes, 240);
});

test("events: validation, ordering by day and time, edit, delete", () => {
  const data = emptyStore();
  const ev = (o: Record<string, unknown> = {}) => ({ title: "Dentist", date: "2026-11-20", start_time: null, end_time: null, color: "blue", notes: null, ...o });
  assert.equal(call(data, "POST", "/api/events", ev({ title: " " })).status, 422);
  assert.equal(call(data, "POST", "/api/events", ev({ start_time: "25:00" })).status, 422);
  assert.equal(call(data, "POST", "/api/events", ev({ end_time: "10:00" })).status, 422);
  assert.equal(call(data, "POST", "/api/events", ev({ start_time: "10:00", end_time: "09:00" })).status, 422);
  assert.equal(call(data, "POST", "/api/events", ev({ color: "gold" })).status, 422);
  assert.equal(data.events.length, 0);
  assert.equal(data.next_id.events, 1);

  call(data, "POST", "/api/events", ev({ title: "Gym", start_time: "18:00", end_time: "19:00", color: "green" }));
  call(data, "POST", "/api/events", ev({ title: "Birthday", color: "pink" }));
  call(data, "POST", "/api/events", ev({ title: "Coffee", start_time: "08:30" }));
  call(data, "POST", "/api/events", ev({ title: "Trip", date: "2026-12-05" }));

  const nov = (call(data, "GET", "/api/events?start=2026-11-01&end=2026-11-30").body as { events: { title: string }[] }).events;
  assert.deepEqual(nov.map((e) => e.title), ["Birthday", "Coffee", "Gym"]);

  const upd = call(data, "PUT", "/api/events/3", ev({ title: "Coffee with a friend", start_time: "09:00", notes: "  bring book " }));
  assert.equal((upd.body as { notes: string }).notes, "bring book");
  assert.equal(call(data, "POST", "/api/events/4/delete", {}).status, 200);
  assert.equal(call(data, "POST", "/api/events/4/delete", {}).status, 404);
  assert.equal(call(data, "GET", "/api/events?start=bad&end=2026-11-30").status, 422);
  assert.equal(normalizeStore({ events: [{ id: 9 }] }).next_id.events, 10);
});
