import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyStore, handleLocalRequest, type StoreData } from "../src/services/localStore.ts";
import { EVENT_ID_BASE, TASK_ID_BASE, planReminders } from "../src/services/reminderPlan.ts";

const NOW = new Date(2026, 10, 18, 12, 0); // 18 Nov 2026, 12:00 local

function call(data: StoreData, method: string, path: string, body?: unknown) {
  return handleLocalRequest(data, { method, path, body }, NOW);
}

const task = (o: Record<string, unknown> = {}) => ({ title: "Call mum", notes: null, due_date: null, priority: "none", status: "todo", job_id: null, ...o });
const ev = (o: Record<string, unknown> = {}) => ({ title: "Dentist", date: "2026-11-20", start_time: "10:00", end_time: null, color: "red", notes: null, alert: 30, ...o });

test("task reminders: validated, kept when left out, cleared when set to null", () => {
  const data = emptyStore();
  assert.equal(call(data, "POST", "/api/tasks", task({ remind_at: "2026-11-18 17:00" })).status, 422);
  assert.equal(call(data, "POST", "/api/tasks", task({ remind_at: "2026-02-30T17:00" })).status, 422);

  call(data, "POST", "/api/tasks", task({ remind_at: "2026-11-18T17:00" }));
  // Ticking it off from a screen that doesn't send remind_at keeps the reminder value.
  call(data, "PUT", "/api/tasks/1", task({ title: "Call mum back" }));
  assert.equal(data.tasks[0].remind_at, "2026-11-18T17:00");
  call(data, "PUT", "/api/tasks/1", task({ remind_at: null }));
  assert.equal(data.tasks[0].remind_at, null);
});

test("event reminders: only allowed offsets", () => {
  const data = emptyStore();
  assert.equal(call(data, "POST", "/api/events", ev({ alert: 7 })).status, 422);
  assert.equal(call(data, "POST", "/api/events", ev({ alert: null })).status, 201);
  assert.equal(data.events[0].alert, null);
});

test("plans upcoming reminders, soonest first, skipping past and done ones", () => {
  const data = emptyStore();
  call(data, "POST", "/api/tasks", task({ title: "Later today", remind_at: "2026-11-18T17:00" }));
  call(data, "POST", "/api/tasks", task({ title: "Already passed", remind_at: "2026-11-18T08:00" }));
  call(data, "POST", "/api/tasks", task({ title: "Done", status: "done", remind_at: "2026-11-19T08:00" }));
  call(data, "POST", "/api/tasks", task({ title: "Too far", remind_at: "2027-03-01T08:00" }));
  call(data, "POST", "/api/events", ev()); // 20 Nov 10:00, 30 min before
  call(data, "POST", "/api/events", ev({ title: "Birthday", date: "2026-11-19", start_time: null, alert: 0 })); // all day → 9:00
  call(data, "POST", "/api/events", ev({ title: "No alert", alert: null }));

  const plan = planReminders(data, NOW);
  assert.deepEqual(plan.map((r) => r.title), ["Later today", "Birthday", "Dentist"]);
  assert.equal(plan[0].id, TASK_ID_BASE + 1);
  assert.equal(plan[0].at.getTime(), new Date(2026, 10, 18, 17, 0).getTime());
  assert.equal(plan[1].at.getTime(), new Date(2026, 10, 19, 9, 0).getTime());
  assert.match(plan[1].body, /Today · All day/); // worded for when it rings
  assert.equal(plan[2].id, EVENT_ID_BASE + 1 * 1000);
  assert.equal(plan[2].at.getTime(), new Date(2026, 10, 20, 9, 30).getTime());
  assert.match(plan[2].body, /^Today at /);
});

test("caps the number of scheduled reminders", () => {
  const data = emptyStore();
  for (let i = 0; i < 80; i++) {
    call(data, "POST", "/api/tasks", task({ title: `T${i}`, remind_at: `2026-11-${String(19 + (i % 10)).padStart(2, "0")}T09:00` }));
  }
  assert.equal(planReminders(data, NOW).length, 60);
});
