"use client";
import { useState, type FormEvent } from "react";
import { BOOTHS, getBooth } from "@/lib/config";
import type { Result } from "@/lib/store";

export function Admin() {
  const [key, setKey] = useState(""); const [unlocked, setUnlocked] = useState(false);
  const [attempts, setAttempts] = useState<Result[]>([]); const [message, setMessage] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [booth, setBooth] = useState("cs"); const [teamName, setTeamName] = useState(""); const [value, setValue] = useState("");
  const [voidId, setVoidId] = useState<string | null>(null); const [reason, setReason] = useState("");
  const [filter, setFilter] = useState("");
  const scoring = getBooth(booth)!.scoring;
  async function api(path: string, method = "GET", body?: unknown) {
    const response = await fetch(path, { method, headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed."); return data;
  }
  async function load() { const data = await api("/api/admin/attempts"); setAttempts(data.attempts); setUnlocked(true); }
  async function run(action: () => Promise<void>) { setBusy(true); setError(""); setMessage(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Request failed."); } finally { setBusy(false); } }
  async function unlock(e: FormEvent) { e.preventDefault(); await run(load); }
  async function add(e: FormEvent) {
    e.preventDefault();
    await run(async () => { await api("/api/admin/attempts", "POST", { booth, teamName, [scoring.type]: Number(value) }); setTeamName(""); setValue(""); await load(); setMessage("Official result recorded. Public standings will refresh within 5 seconds."); });
  }
  async function voidResult(e: FormEvent) {
    e.preventDefault(); await run(async () => { await api(`/api/admin/attempts/${voidId}/void`, "POST", { reason }); setVoidId(null); setReason(""); await load(); setMessage("Result voided. You can now submit the corrected result."); });
  }
  function exportCsv() {
    function cell(value: unknown) { const text = String(value ?? ""); return `"${(/^[=+@\-\t\r\n]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`; }
    const rows: unknown[][] = [["Team", "Booth", "Duration (seconds)", "Raw points", "Score", "Recorded at", "Voided at", "Reason"], ...attempts.map(a => [a.teamName, a.booth, a.duration, a.points, a.score, a.createdAt, a.voidedAt, a.voidReason])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(r => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "gdg-kickoff-results.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return <main className="shell admin-shell"><span className="eyebrow">BEHIND THE BOARDS</span><div className="admin-title"><div><h1>Organizer <span>console.</span></h1><p className="intro">Manage official results and keep the competition moving.</p></div>{unlocked ? <button className="button" onClick={() => { setKey(""); setUnlocked(false); setAttempts([]); setError(""); setMessage(""); }}>Lock console</button> : null}</div>
    {error ? <div className="notice error-notice" role="alert">{error}</div> : null}{message ? <div className="notice success-notice" role="status">{message}</div> : null}
    {!unlocked ? <form className="panel login-panel" onSubmit={unlock}><span className="label">ORGANIZER ACCESS</span><h2>Let’s get you in.</h2><p>Enter the organizer API key configured for this deployment. Your key stays in this tab’s memory and is cleared when you lock or reload.</p><label htmlFor="admin-key">Organizer API key</label><input id="admin-key" type="password" required minLength={32} autoComplete="off" value={key} onChange={e => setKey(e.target.value)}/><button className="button primary" disabled={busy}>{busy ? "Connecting…" : "Unlock console →"}</button><p className="fine-print">The sample demo is readonly. Connect Neon and set ADMIN_API_KEY before using the console.</p></form> : <>
    <section className="panel guide-card"><span className="label">RECORD A RESULT</span><h2>One team. One official score.</h2><p>Use this for manual entry or to replace a result after voiding it. Organizer submissions can also be made after booth submissions close.</p><form onSubmit={add} className="entry-form"><label>Booth<select value={booth} onChange={e => { setBooth(e.target.value); setValue(""); }}>{BOOTHS.map(b => <option key={b.id} value={b.id}>{b.id.toUpperCase()} · {b.name}</option>)}</select></label><label>Team name<input value={teamName} onChange={e => setTeamName(e.target.value)} required minLength={2} maxLength={48} placeholder="e.g. Null Pointers"/></label><label>{scoring.type === "duration" ? "Duration (seconds)" : "Game points"}<input type="number" step="any" min={scoring.type === "duration" ? "0.001" : "0"} max="1000000000" required value={value} onChange={e => setValue(e.target.value)}/></label><button className="button primary" disabled={busy}>{busy ? "Saving…" : "Record result ↗"}</button></form></section>
    <section className="panel guide-card"><div className="section-title"><div><span className="label">THE AUDIT TRAIL</span><h2>All submissions <span className="count-chip">{attempts.length}</span></h2></div><div className="button-row"><button className="button" onClick={() => void run(load)} disabled={busy}>Refresh</button><button className="button" onClick={exportCsv}>Export CSV ↓</button></div></div><label className="admin-filter">Filter by team<input placeholder="Search team names…" value={filter} onChange={e => setFilter(e.target.value)}/></label><div className="audit-wrap"><table className="audit-table"><thead><tr><th>TEAM / RECORDED</th><th>BOOTH</th><th>RAW RESULT</th><th>SCORE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{attempts.filter(a => a.teamName.toLowerCase().includes(filter.toLowerCase())).map(a => <tr key={a.id} className={a.voidedAt ? "voided" : ""}><td><strong>{a.teamName}</strong><small>{new Date(a.createdAt).toLocaleString()}</small></td><td>{a.booth.toUpperCase()}</td><td>{a.duration !== null ? `${a.duration}s` : `${a.points} pts`}</td><td>{a.score.toLocaleString()}</td><td>{a.voidedAt ? <span title={a.voidReason ?? ""}>Voided</span> : "Active"}</td><td>{!a.voidedAt ? <button className="text-button danger" disabled={busy} onClick={() => { setVoidId(a.id); setReason(""); }}>Void result</button> : <small>{a.voidReason}</small>}</td></tr>)}</tbody></table>{!attempts.length ? <p className="no-match">No submissions yet. Ready when your booths are.</p> : null}</div></section></>}
    {voidId ? <dialog className="panel modal" aria-labelledby="void-title" ref={node => { if (node && !node.open) node.showModal(); }} onCancel={event => { event.preventDefault(); if (!busy) setVoidId(null); }}><form onSubmit={voidResult}><h2 id="void-title">Void this result?</h2><p>This removes the score from the public standings and may remove the team from the overall board. The original stays in the audit trail.</p><label htmlFor="void-reason">Reason for correction</label><input id="void-reason" autoFocus required minLength={3} maxLength={240} value={reason} onChange={e => setReason(e.target.value)}/><div className="button-row"><button type="button" className="button" disabled={busy} onClick={() => setVoidId(null)}>Cancel</button><button className="button danger-button" disabled={busy}>{busy ? "Voiding…" : "Void result"}</button></div></form></dialog> : null}
  </main>;
}
