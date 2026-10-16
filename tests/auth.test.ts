import { test } from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { SignJWT } from "jose";
import { checkCredentials, issueSession, requireOrganizer, SESSION_COOKIE, validSession } from "../src/lib/organizer-auth";
import { POST as signIn } from "../src/app/api/auth/sign-in/route";
import { POST as signOut } from "../src/app/api/auth/sign-out/route";

test("organizer login verifies credentials, signs secure sessions, and rejects tampering, expiry and cross-origin requests", async () => {
  const original = { ...process.env };
  try {
    const salt = "12".repeat(16);
    process.env.ORGANIZER_USERNAME = "Test Host";
    process.env.ORGANIZER_PASSWORD_HASH = `scrypt:${salt}:${scryptSync("test-password", salt, 64).toString("hex")}`;
    process.env.ORGANIZER_SESSION_SECRET = "test-session-secret-".repeat(3);
    const request = (body: unknown, origin = "https://event.example") => new Request("https://event.example/api/auth/sign-in", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });
    assert.equal(await checkCredentials("Test Host", "test-password"), true);
    assert.equal(await checkCredentials("Other Host", "test-password"), false);
    assert.equal(await checkCredentials("Test Host", "incorrect"), false);
    assert.equal((await signIn(request({ username: "Test Host", password: "incorrect" }))).status, 401);
    assert.equal((await signIn(request({ username: "Test Host", password: "test-password" }, "https://elsewhere.example"))).status, 403);
    const login = await signIn(request({ username: "Test Host", password: "test-password" }));
    assert.equal(login.status, 200);
    const localLogin = await signIn(new Request("http://localhost:3000/api/auth/sign-in", { method: "POST", headers: { "Content-Type": "application/json", Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" }, body: JSON.stringify({ username: "Test Host", password: "test-password" }) }));
    assert.equal(localLogin.status, 200);
    const cookie = login.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Secure/); assert.match(cookie, /Max-Age=43200/);
    const token = cookie.split(";")[0].slice(SESSION_COOKIE.length + 1);
    assert.equal(await validSession(token), true);
    assert.equal(await validSession(`${token}x`), false);
    assert.equal(await validSession(undefined), false);
    await requireOrganizer(new Request("https://event.example/api/admin/attempts", { headers: { Cookie: cookie.split(";")[0] } }));
    await assert.rejects(requireOrganizer(new Request("https://event.example/api/admin/attempts")), /sign in/);
    await assert.rejects(requireOrganizer(new Request("https://event.example/api/admin/reset", { method: "POST", headers: { Cookie: cookie.split(";")[0], Origin: "https://elsewhere.example" } })), /this website/);
    const expired = await new SignJWT({ role: "organizer" }).setProtectedHeader({ alg: "HS256" }).setIssuer("gdg-htu-kickoff").setAudience("organizer").setIssuedAt(1).setExpirationTime(2).sign(new TextEncoder().encode(process.env.ORGANIZER_SESSION_SECRET));
    assert.equal(await validSession(expired), false);
    const logout = await signOut(new Request("https://event.example/api/auth/sign-out", { method: "POST" }));
    assert.equal(logout.status, 200); assert.match(logout.headers.get("set-cookie")!, /Max-Age=0/);
    process.env.ORGANIZER_USERNAME = "Changed Host";
    assert.equal(await validSession(token), false);
    delete process.env.ORGANIZER_SESSION_SECRET;
    assert.equal(await validSession(token), false);
    assert.equal((await signIn(request({ username: "Test Host", password: "test-password" }))).status, 503);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});
