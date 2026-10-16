import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { BOOTHS, getBooth } from "../src/lib/config";
import { AppError, calculateScore, normalizeName, parseSubmission } from "../src/lib/scoring";
import { readResults, resetLeaderboard, snapshot, submit, voidAttempt } from "../src/lib/store";
import { idempotencyKey, jsonBody } from "../src/lib/http";
import type { Query } from "../src/lib/db";

test("all booth configurations have valid nonzero scoring ranges", () => {
  for (const b of BOOTHS) {
    const s = b.scoring;
    if (s.type === "duration") assert.ok(s.fast >= 0 && s.slow > s.fast);
    else assert.ok(s.min >= 0 && s.max > s.min);
  }
});

test("duration and points have clamped, comparable 0–1000 scores", () => {
  const cs = getBooth("cs")!, ai = getBooth("ai")!;
  assert.equal(calculateScore(cs, 10), 1000);
  assert.equal(calculateScore(cs, 30), 1000);
  assert.equal(calculateScore(cs, 60), 750);
  assert.equal(calculateScore(cs, 150), 0);
  assert.equal(calculateScore(cs, 500), 0);
  assert.equal(calculateScore(ai, 0), 0);
  assert.equal(calculateScore(ai, 50), 500);
  assert.equal(calculateScore(ai, 150), 1000);
});
test("names match after Unicode, whitespace and case normalization", () => {
  assert.deepEqual(normalizeName("  Null   Pointers "), { teamName: "Null Pointers", teamKey: "null pointers" });
  assert.equal(normalizeName("Ｎｕｌｌ Pointers").teamKey, "null pointers");
  for (const name of ["a", "\u0000team", "hidden\u200Bteam", "a".repeat(49), null]) assert.throws(() => normalizeName(name), AppError);
});
test("submissions reject wrong units, ambiguous fields, nonfinite and invalid values", () => {
  const cs = getBooth("cs")!;
  for (const body of [null, [], {}, { teamName: "Team", duration: 0 }, { teamName: "Team", duration: -1 }, { teamName: "Team", duration: "50" }, { teamName: "Team", duration: Infinity }, { teamName: "Team", points: 100 }, { teamName: "Team", duration: 60, points: 50 }, { teamName: "Team", duration: 10, score: 1000 }]) assert.throws(() => parseSubmission(body, cs), AppError);
  assert.equal(parseSubmission({ teamName: "Team", points: 0 }, getBooth("ai")!).score, 0);
});
test("real Postgres schema: submissions, qualification, replay, uniqueness, voiding and corrections", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
    const query: Query = async (text, params) => (await db.query<Record<string, unknown>>(text, params)).rows;
    const cs = getBooth("cs")!, ai = getBooth("ai")!, cys = getBooth("cys")!;
    const first = await submit(query, "cs", parseSubmission({ teamName: "Null Pointers", duration: 60 }, cs), "cs-1");
    assert.equal(first.score, 750);
    let board = snapshot(await readResults(query));
    assert.equal(board.boards.cs.length, 1); assert.equal(board.boards.overall.length, 0);
    const replay = await submit(query, "cs", parseSubmission({ teamName: "  NULL  pointers ", duration: 60 }, cs), "cs-1");
    assert.equal(replay.attemptId, first.attemptId); assert.equal(replay.replayed, true);
    await assert.rejects(submit(query, "cs", parseSubmission({ teamName: "Null Pointers", duration: 70 }, cs), "cs-1"), /different payload/);
    await assert.rejects(submit(query, "cs", parseSubmission({ teamName: "null pointers", duration: 50 }, cs), "another-key"), /already has a result/);
    await submit(query, "ai", parseSubmission({ teamName: "null pointers", points: 0 }, ai), null);
    board = snapshot(await readResults(query));
    assert.equal(board.totalTeams, 1); assert.equal(board.boards.overall.length, 0);
    await submit(query, "cys", parseSubmission({ teamName: "NULL POINTERS", duration: 45 }, cys), null);
    board = snapshot(await readResults(query));
    assert.equal(board.boards.overall.length, 1); assert.equal(board.boards.overall[0].score, 1750);
    assert.equal(board.boards.overall[0].completed, 3); assert.equal(board.boards.overall[0].teamName, "Null Pointers");
    await voidAttempt(query, first.attemptId, "Timer malfunction");
    board = snapshot(await readResults(query));
    assert.equal(board.boards.overall.length, 0); assert.equal(board.boards.cs.length, 0);
    const oldReplay = await submit(query, "cs", parseSubmission({ teamName: "Null Pointers", duration: 60 }, cs), "cs-1");
    assert.equal("voided" in oldReplay && oldReplay.voided, true);
    await submit(query, "cs", parseSubmission({ teamName: "Null Pointers", duration: 30 }, cs), "corrected-1");
    board = snapshot(await readResults(query)); assert.equal(board.boards.overall[0].score, 2000);
    const audit = await readResults(query, true); assert.equal(audit.length, 4); assert.equal(audit.filter(a => a.voidedAt).length, 1);
    await assert.rejects(voidAttempt(query, first.attemptId, "Again"), /not found/);
    await submit(query, "cs", parseSubmission({ teamName: "Other Team", duration: 30 }, cs), "other-cs");
    board = snapshot(await readResults(query)); assert.equal(board.boards.cs[0].rank, 1); assert.equal(board.boards.cs[1].rank, 1);
    const duplicates = await Promise.allSettled([1, 2, 3].map(i => submit(query, "ai", parseSubmission({ teamName: "Concurrency Crew", points: 80 }, ai), `race-${i}`)));
    assert.equal(duplicates.filter(r => r.status === "fulfilled").length, 1);
    board = snapshot(await readResults(query)); assert.equal(board.boards.ai.filter(t => t.teamName === "Concurrency Crew").length, 1);
    const total = board.totalResults;
    const history = (await readResults(query, true)).length;
    assert.equal(await resetLeaderboard(query), total);
    board = snapshot(await readResults(query));
    assert.equal(board.totalTeams, 0); assert.equal(board.totalResults, 0); assert.equal(board.qualifiedTeams, 0);
    for (const rows of Object.values(board.boards)) assert.equal(rows.length, 0);
    const afterReset = await readResults(query, true);
    assert.equal(afterReset.length, history); assert.ok(afterReset.every(a => a.voidedAt));
    assert.equal(afterReset.find(a => a.id === first.attemptId)?.voidReason, "Timer malfunction");
    assert.equal(await resetLeaderboard(query), 0);
    const delayedReplay = await submit(query, "cs", parseSubmission({ teamName: "Null Pointers", duration: 60 }, cs), "cs-1");
    assert.equal("voided" in delayedReplay && delayedReplay.voided, true);
    assert.equal((await readResults(query)).length, 0);
    await submit(query, "cs", parseSubmission({ teamName: "Null Pointers", duration: 45 }, cs), "new-round");
    board = snapshot(await readResults(query)); assert.equal(board.boards.cs.length, 1); assert.equal(board.boards.cs[0].score, 875);
    assert.equal(board.boards.overall.length, 0);
  } finally { await db.close(); }
});
test("ranks share positions for ties and incomplete teams never enter overall", () => {
  const results = ["A Team", "B Team", "C Team"].flatMap((teamName, i) => BOOTHS.slice(0, i === 2 ? 1 : 3).map(b => ({ id: `${i}-${b.id}`, teamId: String(i), teamName, booth: b.id, duration: null, points: 5, score: 0, createdAt: new Date().toISOString(), voidedAt: null, voidReason: null })));
  const board = snapshot(results);
  assert.equal(board.boards.overall.length, 2); assert.equal(board.boards.overall[1].rank, 1);
  assert.equal(board.boards.cs.length, 3);
});
test("HTTP guards reject oversized and malformed JSON", async () => {
  await assert.rejects(jsonBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })), /Content-Type/);
  await assert.rejects(jsonBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "{" })), /Invalid JSON/);
  await assert.rejects(jsonBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "a".repeat(5000) })), /too large/);
  assert.throws(() => idempotencyKey(new Request("http://localhost", { headers: { "idempotency-key": "bad key" } })), /Idempotency/);
});
