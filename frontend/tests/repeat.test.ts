import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyStore, eventOccurrences, handleLocalRequest, nextRepeatDate, type StoreData } from "../src/services/localStore.ts";
import { planReminders } from "../src/services/reminderPlan.ts";

const NOW = new Date(2026, 10, 18, 12, 0);

function call(data: StoreData, method: string, path: string, body?: unknown) {
  return handleLocalRequest(data, { method, path, body }, NOW);
}

const ev = (o: Record<string, unknown> = {}) => ({
  title: "Gym", date: "2026-11-02", start_time: "18:00", end_time: null, color: "green", notes: null, alert: null, repeat: "none", repeat_until: null, ...o,
});
const task = (o: Record<string, unknown> = {}) => ({ title: "Water plants", notes: null, due_date: "2026-11-18", priority: "none", status: "todo", job_id: null, ...o });

test("next dates for each repeat, including month ends and leap days", () => {
  assert.equal(nextRepeatDate("2026-11-18", "daily"), "2026-11-19");
  assert.equal(nextRepeatDate("2026-11-20", "weekdays"), "2026-11-23"); // Fri → Mon
  assert.equal(nextRepeatDate("2026-11-18", "weekly"), "2026-11-25");
  assert.equal(nextRepeatDate("2026-12-15", "monthly"), "2027-01-15");
  // The 31st only happens in 31-day months.
  assert.equal(nextRepeatDate("2026-01-31", "monthly"), "2026-03-31");
  assert.equal(nextRepeatDate("2026-01-31", "monthly", "2026-03-31"), "2026-05-31");
  // 29 Feb only in leap years.
  assert.equal(nextRepeatDate("2024-02-29", "yearly"), "2028-02-29");
  assert.equal(nextRepeatDate("2026-11-18", "yearly"), "2027-11-18");
});

test("repeating events appear on every matching day in range, until the end date", () => {
  const data = emptyStore();
  call(data, "POST", "/api/events", ev({ repeat: "weekly" }));
  call(data, "POST", "/api/events", ev({ title: "Standup", date: "2026-11-16", repeat: "weekdays", repeat_until: "2026-11-20" }));
  call(data, "POST", "/api/events", ev({ title: "Birthday", date: "2019-11-25", start_time: null, repeat: "yearly" }));

  const nov = (call(data, "GET", "/api/events?start=2026-11-01&end=2026-11-30").body as { events: { title: string; date: string; series_start: string }[] }).events;
  const dates = (title: string) => nov.filter((e) => e.title === title).map((e) => e.date);
  assert.deepEqual(dates("Gym"), ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]);
  assert.deepEqual(dates("Standup"), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
  assert.deepEqual(dates("Birthday"), ["2026-11-25"]);
  assert.equal(nov.find((e) => e.title === "Birthday")!.series_start, "2019-11-25");
});

test("validates repeat settings", () => {
  const data = emptyStore();
  assert.equal(call(data, "POST", "/api/events", ev({ repeat: "hourly" })).status, 422);
  assert.equal(call(data, "POST", "/api/events", ev({ repeat: "weekly", repeat_until: "2026-10-01" })).status, 422);
  call(data, "POST", "/api/events", ev({ repeat: "none", repeat_until: "2026-12-01" }));
  assert.equal(data.events[0].repeat_until, null);
});

test("event occurrence helper ignores events outside the range", () => {
  const data = emptyStore();
  call(data, "POST", "/api/events", ev({ repeat: "daily", repeat_until: "2026-11-05" }));
  assert.deepEqual(eventOccurrences(data.events[0], "2026-11-04", "2026-11-30"), ["2026-11-04", "2026-11-05"]);
  assert.deepEqual(eventOccurrences(data.events[0], "2026-12-01", "2026-12-31"), []);
});

test("finishing a repeating task creates the next one, moving its reminder too", () => {
  const data = emptyStore();
  call(data, "POST", "/api/tasks", task({ repeat: "weekly", remind_at: "2026-11-18T08:00" }));
  // Ticked off from a screen that doesn't send repeat/remind_at.
  call(data, "PUT", "/api/tasks/1", task({ status: "done" }));

  assert.equal(data.tasks.length, 2);
  const [done, next] = data.tasks;
  assert.equal(done.status, "done");
  assert.equal(done.repeat, "none");
  assert.equal(next.status, "todo");
  assert.equal(next.due_date, "2026-11-25");
  assert.equal(next.remind_at, "2026-11-25T08:00");
  assert.equal(next.repeat, "weekly");

  // Un-ticking and re-ticking the finished one doesn't create duplicates.
  call(data, "PUT", "/api/tasks/1", task({ status: "todo" }));
  call(data, "PUT", "/api/tasks/1", task({ status: "done" }));
  assert.equal(data.tasks.length, 2);
});

test("repeating event reminders are planned for each upcoming occurrence", () => {
  const data = emptyStore();
  call(data, "POST", "/api/events", ev({ date: "2026-11-18", repeat: "daily", alert: 15 }));
  const plan = planReminders(data, NOW, 3);
  assert.equal(plan.length, 3); // 18th, 19th, 20th at 17:45
  assert.equal(new Set(plan.map((p) => p.id)).size, 3);
  assert.equal(plan[0].at.getTime(), new Date(2026, 10, 18, 17, 45).getTime());
});
