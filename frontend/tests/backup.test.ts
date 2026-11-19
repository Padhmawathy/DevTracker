import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBackup } from "../src/services/backupFormat.ts";
import { emptyStore, handleLocalRequest } from "../src/services/localStore.ts";

function backupOf(data: unknown, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ app: "DevTrack", kind: "backup", format: 1, exported_at: "2026-11-18T10:00:00.000Z", data, ...extra });
}

test("a backup round-trips everything", () => {
  const data = emptyStore();
  handleLocalRequest(data, { method: "POST", path: "/api/tasks", body: { title: "Pay rent", due_date: "2026-12-01" } });
  handleLocalRequest(data, { method: "POST", path: "/api/notes", body: { title: "Ideas", body: "…" } });
  handleLocalRequest(data, { method: "POST", path: "/api/events", body: { title: "Dentist", date: "2026-11-20", color: "red" } });
  handleLocalRequest(data, { method: "PUT", path: "/api/profile", body: { display_name: "Sam" } });

  const { data: restored, summary } = parseBackup(backupOf(data));
  assert.deepEqual(restored, data);
  assert.deepEqual(summary, { tasks: 1, events: 1, notes: 1, exportedAt: "2026-11-18T10:00:00.000Z" });
});

test("rejects files that are not DevTrack backups", () => {
  assert.throws(() => parseBackup("not json"), /isn't a DevTrack backup/);
  assert.throws(() => parseBackup(JSON.stringify({ tasks: [] })), /isn't a DevTrack backup/);
  assert.throws(() => parseBackup(backupOf(emptyStore(), { format: 2 })), /newer version/);
});

test("older backups missing newer sections still restore", () => {
  const { data } = parseBackup(backupOf({ tasks: [{ id: 3, title: "Old" }] }));
  assert.equal(data.tasks.length, 1);
  assert.deepEqual(data.notes, []);
  assert.deepEqual(data.events, []);
  assert.equal(data.next_id.tasks, 4);
});
