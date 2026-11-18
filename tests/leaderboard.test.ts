import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { BOOTHS, getBooth } from "../src/lib/config";
import { AppError, normalizeName, parseSubmission } from "../src/lib/scoring";
import { deleteAttemptLog, readOrganizerData, readResults, renameTeam, resetLeaderboard, snapshot, submit, voidAttempt, wipeLogs, wipeTeams } from "../src/lib/store";
import { idempotencyKey, jsonBody } from "../src/lib/http";
import type { Query } from "../src/lib/db";

async function withDb(run: (query: Query) => Promise<void>) {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
    await run(async (text, params) => (await db.query<Record<string, unknown>>(text, params)).rows);
  } finally { await db.close(); }
}
const booth = (id: string) => getBooth(id)!;
const entry = (teamName: string, points: number, id: string) => parseSubmission({ teamName, points }, booth(id));

test("log deletion only removes voided history and preserves active standings", () => withDb(async query => {
  const old = await submit(query, booth("cys"), entry("Log Team", 750, "cys"), "old-result");
  await assert.rejects(deleteAttemptLog(query, old.attemptId), /Active scores must be removed first/);
  await voidAttempt(query, old.attemptId, "Correction");
  const active = await submit(query, booth("cys"), entry("Log Team", 750, "cys"), "new-result");
  assert.deepEqual(await deleteAttemptLog(query, old.attemptId), { deleted: true });
  const remaining = await readResults(query, true);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].id, active.attemptId);
  assert.equal(snapshot(remaining).boards.gdg[0].score, 750);
  await assert.rejects(deleteAttemptLog(query, old.attemptId), /Removed log not found/);
}));

test("wiping logs keeps teams while wiping teams clears their records and submissions", () => withDb(async query => {
  const data = entry("Cleanup Team", 750, "doodle-rocket");
  const removed = await submit(query, booth("doodle-rocket"), data, "old-score");
  await voidAttempt(query, removed.attemptId, "Correction");
  const active = await submit(query, booth("doodle-rocket"), data, "new-score");
  const before = await readOrganizerData(query);
  assert.equal(before.attempts.length, 2);
  assert.equal(before.teams.length, 1);

  await wipeLogs(query);
  assert.deepEqual(await readOrganizerData(query), { teams: before.teams, attempts: [] });
  assert.equal(snapshot(await readResults(query)).totalResults, 0);
  const fresh = await submit(query, booth("doodle-rocket"), data, "new-score");
  assert.notEqual(fresh.attemptId, active.attemptId);
  assert.equal((await readResults(query))[0].teamId, before.teams[0].id);

  await wipeTeams(query);
  assert.deepEqual(await readOrganizerData(query), { teams: [], attempts: [] });
  const restarted = await submit(query, booth("doodle-rocket"), data, "new-score");
  assert.equal(restarted.replayed, false);
  assert.notEqual((await readResults(query))[0].teamId, before.teams[0].id);
}));

test("four booths in two clubs accept direct points", () => {
  assert.deepEqual(BOOTHS.map(b => b.id), ["cys", "ai", "doodle-rocket", "coaster-chaser"]);
  assert.deepEqual(BOOTHS.map(b => b.club), ["gdg", "gdg", "gdvc", "gdvc"]);
  assert.deepEqual(BOOTHS.map(b => b.maxSubmissions), [1, 2, 1, 1]);
  for (const b of BOOTHS) assert.equal(parseSubmission({ teamName: "Team", points: 500 }, b).score, 500);
  assert.equal(getBooth("cs"), undefined);
});

test("names match after Unicode, whitespace and case normalization", () => {
  assert.deepEqual(normalizeName("  Null   Pointers "), { teamName: "Null Pointers", teamKey: "null pointers" });
  assert.equal(normalizeName("Ｎｕｌｌ Pointers").teamKey, "null pointers");
  for (const name of ["a", "\u0000team", "hidden\u200Bteam", "a".repeat(49), null]) assert.throws(() => normalizeName(name), AppError);
});

test("submissions accept only integer points from 0 to 1,000", () => {
  const cys = booth("cys");
  for (const body of [null, [], {}, { teamName: "Team", duration: 60 }, { teamName: "Team", points: -1 }, { teamName: "Team", points: 1001 }, { teamName: "Team", points: 50.5 }, { teamName: "Team", points: "50" }, { teamName: "Team", points: Infinity }, { teamName: "Team", points: 500, score: 500 }]) assert.throws(() => parseSubmission(body, cys), AppError);
  assert.equal(parseSubmission({ teamName: "Team", points: 0 }, cys).score, 0);
  assert.equal(parseSubmission({ teamName: "Team", points: 1000 }, cys).score, 1000);
});

test("single-play booths reject replays but honour idempotent retries", () => withDb(async query => {
  const first = await submit(query, booth("cys"), entry("Null Pointers", 750, "cys"), "cys-1");
  assert.equal(first.score, 750); assert.equal(first.created, true); assert.equal(first.complete, true);
  const retry = await submit(query, booth("cys"), entry("  NULL  pointers ", 750, "cys"), "cys-1");
  assert.equal(retry.attemptId, first.attemptId); assert.equal(retry.replayed, true);
  await assert.rejects(submit(query, booth("cys"), entry("Null Pointers", 700, "cys"), "cys-1"), /different payload/);
  for (const points of [500, 750, 900]) await assert.rejects(submit(query, booth("cys"), entry("null pointers", points, "cys"), null), (e: AppError) => e.status === 409 && /Replays are not allowed/.test(e.message));
  assert.equal(snapshot(await readResults(query)).boards.gdg[0].score, 750);
  // Removing a score lets the team play again.
  await voidAttempt(query, first.attemptId, "Organizer allowed a replay");
  const again = await submit(query, booth("cys"), entry("Null Pointers", 900, "cys"), null);
  assert.equal(again.created, true); assert.equal(again.score, 900);
}));

test("AI booth takes game 1, then the running total, then nothing more", () => withDb(async query => {
  const ai = booth("ai");
  const game1 = await submit(query, ai, entry("Gradient Gang", 400, "ai"), "ai-g1");
  assert.equal(game1.created, true); assert.equal(game1.complete, false); assert.equal(game1.submissions, 1);
  let results = await readResults(query);
  assert.equal(results[0].submissions, 1);
  assert.equal(snapshot(results).boards.gdg[0].score, 400);
  // A retry of game 1 with its key is safe.
  assert.equal((await submit(query, ai, entry("Gradient Gang", 400, "ai"), "ai-g1")).replayed, true);
  // The total can't go below game 1.
  await assert.rejects(submit(query, ai, entry("Gradient Gang", 300, "ai"), null), (e: AppError) => e.status === 400 && /can't be lower/.test(e.message));
  const total = await submit(query, ai, entry("Gradient Gang", 850, "ai"), "ai-g2");
  assert.equal(total.created, false); assert.equal(total.updated, true); assert.equal(total.complete, true);
  assert.equal(total.attemptId, game1.attemptId); assert.equal(total.score, 850);
  assert.equal((await submit(query, ai, entry("Gradient Gang", 850, "ai"), "ai-g2")).replayed, true);
  await assert.rejects(submit(query, ai, entry("Gradient Gang", 1000, "ai"), null), (e: AppError) => e.status === 409);
  results = await readResults(query);
  assert.equal(results.length, 1); assert.equal(results[0].score, 850); assert.equal(results[0].submissions, 2);
}));

test("organizer entries are final and never overwrite an active score", () => withDb(async query => {
  const ai = booth("ai");
  const manual = await submit(query, ai, entry("Byte Me", 600, "ai"), null, { organizer: true });
  assert.equal(manual.complete, true);
  await assert.rejects(submit(query, ai, entry("Byte Me", 900, "ai"), null), /Replays are not allowed/);
  await assert.rejects(submit(query, ai, entry("Byte Me", 900, "ai"), null, { organizer: true }), /Remove it first/);
  await submit(query, ai, entry("Ctrl Alt Elite", 300, "ai"), null);
  await assert.rejects(submit(query, ai, entry("Ctrl Alt Elite", 900, "ai"), null, { organizer: true }), /Remove it first/);
}));

test("club and overall boards sum their games and include partial teams", () => withDb(async query => {
  await submit(query, booth("cys"), entry("Null Pointers", 900, "cys"), null);
  await submit(query, booth("ai"), entry("Null Pointers", 800, "ai"), null);
  await submit(query, booth("doodle-rocket"), entry("Null Pointers", 700, "doodle-rocket"), null);
  await submit(query, booth("coaster-chaser"), entry("Null Pointers", 600, "coaster-chaser"), null);
  await submit(query, booth("doodle-rocket"), entry("Hello World", 1000, "doodle-rocket"), null);
  await submit(query, booth("coaster-chaser"), entry("Hello World", 1000, "coaster-chaser"), null);
  let board = snapshot(await readResults(query));
  assert.deepEqual(board.boards.overall.map(t => [t.teamName, t.score, t.rank, t.completed]), [["Null Pointers", 3000, 1, 4], ["Hello World", 2000, 2, 2]]);
  assert.deepEqual(board.boards.gdg.map(t => [t.teamName, t.score, t.completed]), [["Null Pointers", 1700, 2]]);
  assert.deepEqual(board.boards.gdvc.map(t => [t.teamName, t.score, t.rank]), [["Hello World", 2000, 1], ["Null Pointers", 1300, 2]]);
  const teamId = board.boards.overall[0].teamId;
  assert.deepEqual(await renameTeam(query, teamId, "Null Pointers HTU", "null pointers htu"), { teamId, teamName: "Null Pointers HTU" });
  assert.equal(snapshot(await readResults(query)).boards.gdvc[1].teamName, "Null Pointers HTU");
  await assert.rejects(renameTeam(query, board.boards.gdvc[0].teamId, "NULL POINTERS HTU", "null pointers htu"), /already uses/);
  await submit(query, booth("cys"), entry("Tie Team", 1000, "cys"), null);
  await submit(query, booth("ai"), entry("Tie Team", 700, "ai"), null);
  board = snapshot(await readResults(query));
  assert.deepEqual(board.boards.gdg.map(t => t.rank), [1, 1]);
  const total = board.totalResults; const history = (await readResults(query, true)).length;
  assert.equal(await resetLeaderboard(query), total);
  board = snapshot(await readResults(query)); assert.equal(board.totalTeams, 0); assert.equal(board.totalResults, 0);
  assert.equal((await readResults(query, true)).length, history);
  // After a reset everyone may play again.
  const replay = await submit(query, booth("cys"), entry("Null Pointers HTU", 875, "cys"), null);
  assert.equal(replay.created, true);
}));

test("HTTP guards reject oversized and malformed JSON", async () => {
  await assert.rejects(jsonBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })), /Content-Type/);
  await assert.rejects(jsonBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "{" })), /Invalid JSON/);
  await assert.rejects(jsonBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "a".repeat(5000) })), /too large/);
  assert.throws(() => idempotencyKey(new Request("http://localhost", { headers: { "idempotency-key": "bad key" } })), /Idempotency/);
});
