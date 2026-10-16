import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/v1/booths/[booth]/scores/route";
import { GET as leaderboard } from "../src/app/api/v1/leaderboards/route";
import { GET as audit } from "../src/app/api/admin/attempts/route";

test("route authentication, booth isolation, demo protection and event closure", async () => {
  const original = { ...process.env };
  try {
    process.env.CS_API_KEY = "c".repeat(32); process.env.AI_API_KEY = "a".repeat(32); process.env.ADMIN_API_KEY = "o".repeat(32);
    process.env.DEMO_MODE = "true";
    const context = (booth: string) => ({ params: Promise.resolve({ booth }) });
    const request = (key?: string) => new Request("http://localhost/api/v1/booths/cs/scores", { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ teamName: "Route Team", duration: 60 }) });
    assert.equal((await POST(request(), context("cs"))).status, 401);
    assert.equal((await POST(request(process.env.AI_API_KEY), context("cs"))).status, 401);
    assert.equal((await POST(request(process.env.CS_API_KEY), context("cs"))).status, 403);
    assert.equal((await POST(request(), context("unknown"))).status, 404);
    const board = await leaderboard();
    assert.equal(board.headers.get("cache-control"), "no-store");
    const body = await board.json(); assert.equal(body.demo, true); assert.equal(body.boards.overall.length, 7);
    assert.equal((await audit(new Request("http://localhost/api/admin/attempts"))).status, 401);
    process.env.DEMO_MODE = "false"; process.env.SUBMISSIONS_OPEN = "false";
    assert.equal((await POST(request(process.env.CS_API_KEY), context("cs"))).status, 403);
    delete process.env.DATABASE_URL;
    const unavailable = await leaderboard(); assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).error.includes("DATABASE_URL"), true);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});
