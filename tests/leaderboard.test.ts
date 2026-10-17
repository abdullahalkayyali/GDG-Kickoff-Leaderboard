import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { BOOTHS, getBooth } from "../src/lib/config";
import { AppError, normalizeName, parseSubmission } from "../src/lib/scoring";
import { readResults, renameTeam, resetLeaderboard, snapshot, submit, voidAttempt } from "../src/lib/store";
import { idempotencyKey, jsonBody } from "../src/lib/http";
import type { Query } from "../src/lib/db";

test("all three booths accept direct points", () => {
  assert.deepEqual(BOOTHS.map(booth => booth.id), ["cs", "ai", "cys"]);
  for (const booth of BOOTHS) assert.equal(parseSubmission({ teamName: "Team", points: 500 }, booth).score, 500);
});

test("names match after Unicode, whitespace and case normalization", () => {
  assert.deepEqual(normalizeName("  Null   Pointers "), { teamName: "Null Pointers", teamKey: "null pointers" });
  assert.equal(normalizeName("Ｎｕｌｌ Pointers").teamKey, "null pointers");
  for (const name of ["a", "\u0000team", "hidden\u200Bteam", "a".repeat(49), null]) assert.throws(() => normalizeName(name), AppError);
});

test("submissions accept only integer points from 0 to 1,000", () => {
  const cs = getBooth("cs")!;
  for (const body of [null, [], {}, { teamName: "Team", duration: 60 }, { teamName: "Team", points: -1 }, { teamName: "Team", points: 1001 }, { teamName: "Team", points: 50.5 }, { teamName: "Team", points: "50" }, { teamName: "Team", points: Infinity }, { teamName: "Team", points: 500, score: 500 }]) assert.throws(() => parseSubmission(body, cs), AppError);
  assert.equal(parseSubmission({ teamName: "Team", points: 0 }, cs).score, 0);
  assert.equal(parseSubmission({ teamName: "Team", points: 1000 }, cs).score, 1000);
});

test("real Postgres schema keeps each team’s highest booth score", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
    const query: Query = async (text, params) => (await db.query<Record<string, unknown>>(text, params)).rows;
    const cs = getBooth("cs")!, ai = getBooth("ai")!, cys = getBooth("cys")!;
    const first = await submit(query, "cs", parseSubmission({ teamName: "Null Pointers", points: 750 }, cs), "cs-1");
    assert.equal(first.score, 750); assert.equal("created" in first && first.created, true);
    const replay = await submit(query, "cs", parseSubmission({ teamName: "  NULL  pointers ", points: 750 }, cs), "cs-1");
    assert.equal(replay.attemptId, first.attemptId); assert.equal(replay.replayed, true);
    await assert.rejects(submit(query, "cs", parseSubmission({ teamName: "Null Pointers", points: 700 }, cs), "cs-1"), /different payload/);
    const lower = await submit(query, "cs", parseSubmission({ teamName: "null pointers", points: 500 }, cs), "lower-key");
    assert.equal(lower.score, 750); assert.equal("updated" in lower && lower.updated, false);
    const higher = await submit(query, "cs", parseSubmission({ teamName: "null pointers", points: 900 }, cs), "higher-key");
    assert.equal(higher.score, 900); assert.equal("updated" in higher && higher.updated, true);
    let board = snapshot(await readResults(query));
    assert.equal(board.boards.cs.length, 1); assert.equal(board.boards.cs[0].score, 900);
    await submit(query, "ai", parseSubmission({ teamName: "null pointers", points: 0 }, ai), null);
    await submit(query, "cys", parseSubmission({ teamName: "NULL POINTERS", points: 1000 }, cys), null);
    board = snapshot(await readResults(query));
    assert.equal(board.boards.overall.length, 1); assert.equal(board.boards.overall[0].score, 1900);
    const teamId = board.boards.overall[0].teamId;
    assert.deepEqual(await renameTeam(query, teamId, "Null Pointers HTU", "null pointers htu"), { teamId, teamName: "Null Pointers HTU" });
    assert.equal(snapshot(await readResults(query)).boards.overall[0].teamName, "Null Pointers HTU");
    await voidAttempt(query, first.attemptId, "Wrong score");
    assert.equal(snapshot(await readResults(query)).boards.overall.length, 0);
    await submit(query, "cs", parseSubmission({ teamName: "Null Pointers HTU", points: 1000 }, cs), "corrected-1");
    board = snapshot(await readResults(query)); assert.equal(board.boards.overall[0].score, 2000);
    assert.equal((await readResults(query, true)).filter(result => result.voidedAt).length, 1);
    await submit(query, "cs", parseSubmission({ teamName: "Other Team", points: 1000 }, cs), "other-cs");
    const other = snapshot(await readResults(query)).teams.find(team => team.teamName === "Other Team")!;
    await assert.rejects(renameTeam(query, other.teamId, "NULL POINTERS HTU", "null pointers htu"), /already uses/);
    board = snapshot(await readResults(query)); assert.equal(board.boards.cs[0].rank, 1); assert.equal(board.boards.cs[1].rank, 1);
    const total = board.totalResults; const history = (await readResults(query, true)).length;
    assert.equal(await resetLeaderboard(query), total);
    board = snapshot(await readResults(query)); assert.equal(board.totalTeams, 0); assert.equal(board.totalResults, 0);
    assert.equal((await readResults(query, true)).length, history);
    await submit(query, "cs", parseSubmission({ teamName: "Null Pointers HTU", points: 875 }, cs), "new-round");
    board = snapshot(await readResults(query)); assert.equal(board.boards.cs[0].score, 875); assert.equal(board.boards.overall.length, 0);
  } finally { await db.close(); }
});

test("ranks share positions and incomplete teams stay off overall", () => {
  const results = ["A Team", "B Team", "C Team"].flatMap((teamName, i) => BOOTHS.slice(0, i === 2 ? 1 : 3).map(booth => ({ id: `${i}-${booth.id}`, teamId: String(i), teamName, booth: booth.id, duration: null, points: 500, score: 500, createdAt: new Date().toISOString(), voidedAt: null, voidReason: null })));
  const board = snapshot(results);
  assert.equal(board.boards.overall.length, 2); assert.equal(board.boards.overall[1].rank, 1); assert.equal(board.boards.cs.length, 3);
});

test("HTTP guards reject oversized and malformed JSON", async () => {
  await assert.rejects(jsonBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })), /Content-Type/);
  await assert.rejects(jsonBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "{" })), /Invalid JSON/);
  await assert.rejects(jsonBody(new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json" }, body: "a".repeat(5000) })), /too large/);
  assert.throws(() => idempotencyKey(new Request("http://localhost", { headers: { "idempotency-key": "bad key" } })), /Idempotency/);
});
