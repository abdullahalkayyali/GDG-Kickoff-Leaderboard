"use client";
import { useState, type FormEvent } from "react";

export function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign in.");
      setPassword(""); window.location.assign("/admin");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in."); setBusy(false); }
  }
  return <main className="shell admin-shell"><form className="panel login-panel" onSubmit={signIn}>
    <span className="label">ORGANIZER ACCESS</span><h1 className="login-title">Welcome back.</h1>
    <p>Sign in to manage scores and run the kickoff.</p>
    {error ? <div className="notice error-notice" role="alert">{error}</div> : null}
    <label htmlFor="host-username">Username</label><input id="host-username" autoComplete="username" required maxLength={128} value={username} onChange={e => setUsername(e.target.value)} disabled={busy}/>
    <label htmlFor="host-password" className="password-label">Password</label><input id="host-password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/>
    <button className="button primary" disabled={busy}>{busy ? "Signing in…" : "Sign in →"}</button>
    <p className="fine-print">Your session stays signed in for up to 12 hours on this browser.</p>
  </form></main>;
}
