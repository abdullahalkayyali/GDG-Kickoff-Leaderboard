import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/v1/booths/[booth]/scores/route";
import { GET as leaderboard } from "../src/app/api/v1/leaderboards/route";
import { GET as audit } from "../src/app/api/admin/attempts/route";
import { POST as reset } from "../src/app/api/admin/reset/route";
import { POST as add } from "../src/app/api/admin/attempts/route";
import { POST as remove } from "../src/app/api/admin/attempts/[id]/void/route";
import { POST as rename } from "../src/app/api/admin/teams/[id]/rename/route";
import { scryptSync } from "node:crypto";
import { issueSession, SESSION_COOKIE } from "../src/lib/organizer-auth";

test("booth routes stay keyless while organizer routes require a valid session", async () => {
  const original = { ...process.env };
  try {
    process.env.DEMO_MODE = "true";
    const salt = "ab".repeat(16);
    process.env.ORGANIZER_USERNAME = "Test Host";
    process.env.ORGANIZER_PASSWORD_HASH = `scrypt:${salt}:${scryptSync("test-password", salt, 64).toString("hex")}`;
    process.env.ORGANIZER_SESSION_SECRET = "route-test-session-secret-".repeat(3);
    const cookie = `${SESSION_COOKIE}=${await issueSession()}`;
    const context = (booth: string) => ({ params: Promise.resolve({ booth }) });
    const request = (body: unknown = { teamName: "Route Team", points: 750 }) => new Request("http://localhost/api/v1/booths/cs/scores", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body) });
    assert.equal((await audit(new Request("http://localhost/api/admin/attempts"))).status, 401);
    const unsigned = () => new Request("http://localhost/api/admin/attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal((await add(unsigned())).status, 401);
    assert.equal((await reset(unsigned())).status, 401);
    assert.equal((await remove(unsigned(), { params: Promise.resolve({ id: "invalid" }) })).status, 401);
    assert.equal((await rename(unsigned(), { params: Promise.resolve({ id: "invalid" }) })).status, 401);
    assert.equal((await POST(unsigned(), context("cs"))).status, 403);
    assert.equal((await POST(request(), context("cs"))).status, 403);
    assert.equal((await POST(request(), context("unknown"))).status, 404);
    const board = await leaderboard();
    assert.equal(board.headers.get("cache-control"), "no-store");
    const body = await board.json(); assert.equal(body.demo, true); assert.equal(body.boards.overall.length, 7);
    const auditResponse = await audit(new Request("http://localhost/api/admin/attempts", { headers: { Cookie: cookie } }));
    assert.equal(auditResponse.status, 200); assert.equal((await auditResponse.json()).attempts.length, 25);
    assert.equal((await reset(request({ confirmation: "wrong" }))).status, 400);
    assert.equal((await reset(request({ confirmation: "RESET" }))).status, 403);
    assert.equal((await add(request({ booth: "cs", teamName: "Route Team", points: 750 }))).status, 403);
    assert.equal((await remove(request({ reason: "Manually removed" }), { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" }) })).status, 403);
    assert.equal((await rename(request({ teamName: "Renamed Team" }), { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000001" }) })).status, 403);
    process.env.DEMO_MODE = "false"; process.env.SUBMISSIONS_OPEN = "false";
    assert.equal((await POST(request(), context("cs"))).status, 403);
    process.env.SUBMISSIONS_OPEN = "true";
    assert.equal((await POST(request({ teamName: "Route Team", points: -1 }), context("cs"))).status, 400);
    assert.equal((await add(request({ booth: "cs", teamName: "Route Team", points: 1001 }))).status, 400);
    assert.equal((await remove(request({ reason: "Manually removed" }), { params: Promise.resolve({ id: "invalid" }) })).status, 400);
    assert.equal((await rename(request({ teamName: "Renamed Team" }), { params: Promise.resolve({ id: "invalid" }) })).status, 400);
    delete process.env.DATABASE_URL;
    const unavailable = await leaderboard(); assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).error.includes("DATABASE_URL"), true);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});
