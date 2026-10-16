"use client";
import { useEffect, useState, type FormEvent } from "react";
import { BOOTHS, getBooth } from "@/lib/config";
import type { Result } from "@/lib/store";

export function Admin() {
  const [loading, setLoading] = useState(true); const [demo, setDemo] = useState(false);
  const [attempts, setAttempts] = useState<Result[]>([]); const [message, setMessage] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [booth, setBooth] = useState("cs"); const [teamName, setTeamName] = useState(""); const [value, setValue] = useState("");
  const [voidId, setVoidId] = useState<string | null>(null); const [reason, setReason] = useState("");
  const [filter, setFilter] = useState("");
  const [showReset, setShowReset] = useState(false); const [confirmation, setConfirmation] = useState("");
  const activeCount = attempts.filter(a => !a.voidedAt).length;
  const disabled = busy || loading || demo;
  const scoring = getBooth(booth)!.scoring;
  async function api(path: string, method = "GET", body?: unknown) {
    const response = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed."); return data;
  }
  async function load() { const data = await api("/api/admin/attempts"); setAttempts(data.attempts); setDemo(data.demo); }
  useEffect(() => {
    let active = true;
    fetch("/api/admin/attempts", { cache: "no-store" }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load scores.");
      if (active) { setAttempts(data.attempts); setDemo(data.demo); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load scores."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function run(action: () => Promise<void>) { setBusy(true); setError(""); setMessage(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Request failed."); } finally { setBusy(false); } }
  async function add(e: FormEvent) {
    e.preventDefault();
    await run(async () => { await api("/api/admin/attempts", "POST", { booth, teamName, [scoring.type]: Number(value) }); setTeamName(""); setValue(""); await load(); setMessage("Score added. Public standings will refresh within 5 seconds."); });
  }
  async function voidResult(e: FormEvent) {
    e.preventDefault(); await run(async () => { await api(`/api/admin/attempts/${voidId}/void`, "POST", { reason }); setVoidId(null); setReason(""); await load(); setMessage("Score removed. You can now add a replacement for this team and booth."); });
  }
  async function reset(e: FormEvent) {
    e.preventDefault(); await run(async () => {
      const data = await api("/api/admin/reset", "POST", { confirmation });
      setShowReset(false); setConfirmation(""); await load();
      setMessage(`Leaderboard reset: ${data.removed} scores removed. Past results remain in the audit trail.`);
    });
  }
  function exportCsv() {
    function cell(value: unknown) { const text = String(value ?? ""); return `"${(/^[=+@\-\t\r\n]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`; }
    const rows: unknown[][] = [["Team", "Booth", "Duration (seconds)", "Raw points", "Score", "Recorded at", "Voided at", "Reason"], ...attempts.map(a => [a.teamName, a.booth, a.duration, a.points, a.score, a.createdAt, a.voidedAt, a.voidReason])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(r => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "gdg-kickoff-results.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return <main className="shell admin-shell"><span className="eyebrow">BEHIND THE BOARDS</span><div className="admin-title"><div><h1>Organizer <span>console.</span></h1><p className="intro">Add scores, remove mistakes, or start the competition fresh.</p></div><button className="button danger-button" disabled={disabled || activeCount === 0} onClick={() => { setConfirmation(""); setShowReset(true); }}>Reset leaderboard</button></div>
    {error ? <div className="notice error-notice" role="alert">{error}</div> : null}{message ? <div className="notice success-notice" role="status">{message}</div> : null}
    {demo ? <div className="notice demo-notice"><p><strong>Readonly demo.</strong> Connect your database and set DEMO_MODE=false to add, remove, or reset real scores.</p></div> : null}
    {loading ? <p role="status">Loading scores…</p> : null}
    <section className="panel guide-card"><span className="label">MANUAL ENTRY</span><h2>Add a score.</h2><p>Select a booth, enter the team name, and record its duration or game points. Points are calculated automatically. To correct an existing score, remove it below and add its replacement. Organizer submissions can also be made after booth submissions close.</p><form onSubmit={add} className="entry-form"><label>Booth<select disabled={disabled} value={booth} onChange={e => { setBooth(e.target.value); setValue(""); }}>{BOOTHS.map(b => <option key={b.id} value={b.id}>{b.id.toUpperCase()} · {b.name}</option>)}</select></label><label>Team name<input disabled={disabled} value={teamName} onChange={e => setTeamName(e.target.value)} required minLength={2} maxLength={48} placeholder="e.g. Null Pointers"/></label><label>{scoring.type === "duration" ? "Duration (seconds)" : "Game points"}<input disabled={disabled} type="number" step="any" min={scoring.type === "duration" ? "0.001" : "0"} max="1000000000" required value={value} onChange={e => setValue(e.target.value)}/></label><button className="button primary" disabled={disabled}>{busy ? "Saving…" : "Add score ↗"}</button></form></section>
    <section className="panel guide-card"><div className="section-title"><div><span className="label">THE AUDIT TRAIL</span><h2>All submissions <span className="count-chip">{activeCount} active · {attempts.length - activeCount} removed</span></h2></div><div className="button-row"><button className="button" onClick={() => void run(load)} disabled={busy}>Refresh</button><button className="button" onClick={exportCsv}>Export CSV ↓</button></div></div><label className="admin-filter">Filter by team<input placeholder="Search team names…" value={filter} onChange={e => setFilter(e.target.value)}/></label><div className="audit-wrap"><table className="audit-table"><thead><tr><th>TEAM / RECORDED</th><th>BOOTH</th><th>RAW RESULT</th><th>SCORE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{attempts.filter(a => a.teamName.toLowerCase().includes(filter.toLowerCase())).map(a => <tr key={a.id} className={a.voidedAt ? "voided" : ""}><td><strong>{a.teamName}</strong><small>{new Date(a.createdAt).toLocaleString()}</small></td><td>{a.booth.toUpperCase()}</td><td>{a.duration !== null ? `${a.duration}s` : `${a.points} pts`}</td><td>{a.score.toLocaleString()}</td><td>{a.voidedAt ? <span title={a.voidReason ?? ""}>Removed</span> : "Active"}</td><td>{!a.voidedAt ? <button className="text-button danger" disabled={disabled} onClick={() => { setVoidId(a.id); setReason("Manually removed"); }}>Remove score</button> : <small>{a.voidReason}</small>}</td></tr>)}</tbody></table>{!attempts.length ? <p className="no-match">No submissions yet. Ready when your booths are.</p> : null}</div></section>
    {voidId ? <dialog className="panel modal" aria-labelledby="void-title" ref={node => { if (node && !node.open) node.showModal(); }} onCancel={event => { event.preventDefault(); if (!busy) setVoidId(null); }}><form onSubmit={voidResult}><h2 id="void-title">Remove this score?</h2><p>This removes the score from the public standings and may remove the team from the overall board. The original stays in the audit trail.</p><label htmlFor="void-reason">Reason for removal</label><input id="void-reason" autoFocus required minLength={3} maxLength={240} value={reason} onChange={e => setReason(e.target.value)}/><div className="button-row"><button type="button" className="button" disabled={busy} onClick={() => setVoidId(null)}>Cancel</button><button className="button danger-button" disabled={busy}>{busy ? "Removing…" : "Remove score"}</button></div></form></dialog> : null}
    {showReset ? <dialog className="panel modal" aria-labelledby="reset-title" ref={node => { if (node && !node.open) node.showModal(); }} onCancel={event => { event.preventDefault(); if (!busy) setShowReset(false); }}><form onSubmit={reset}><h2 id="reset-title">Reset all four leaderboards?</h2><p>All {activeCount} active scores will be removed from the public standings. Past results remain in the audit trail, and teams can play again with new submissions.</p><label htmlFor="reset-confirmation">Type RESET to confirm</label><input id="reset-confirmation" autoFocus required autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)}/><div className="button-row"><button type="button" className="button" disabled={busy} onClick={() => setShowReset(false)}>Cancel</button><button className="button danger-button" disabled={busy || confirmation !== "RESET"}>{busy ? "Resetting…" : "Reset all leaderboards"}</button></div></form></dialog> : null}
  </main>;
}
