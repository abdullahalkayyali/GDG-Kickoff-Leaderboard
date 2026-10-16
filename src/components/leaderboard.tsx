"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BOOTHS, type BoothId } from "@/lib/config";
import type { RankedTeam, Snapshot } from "@/lib/store";

function Points({ value }: { value: number }) { return <span className="points">{value.toLocaleString("en-US")} <small>pts</small></span>; }
function Trophy() { return <svg viewBox="0 0 80 84" fill="none" aria-hidden="true"><path d="M22 12h36v20c0 13-8 22-18 22s-18-9-18-22V12Z" fill="currentColor"/><path d="M22 18H10v10c0 10 7 16 17 16m31-26h12v10c0 10-7 16-17 16" stroke="currentColor" strokeWidth="5"/><path d="M40 54v14m-15 7h30" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/><path d="m40 23 3.2 6.5 7.2 1-5.2 5.1 1.2 7.2-6.4-3.4-6.4 3.4 1.2-7.2-5.2-5.1 7.2-1L40 23Z" fill="#6e562c"/></svg>; }
function Avatar({ team, place }: { team: string; place: number }) { return <span className={`avatar avatar-${place % 5}`}>{team.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}</span>; }
function Rank({ value }: { value: number }) { return <span className={`rank rank-${value}`}>{value <= 3 ? ["", "01", "02", "03"][value] : String(value).padStart(2, "0")}</span>; }
function Empty({ overall = false }: { overall?: boolean }) { return <div className="empty"><span aria-hidden="true">{overall ? "◇" : "⌁"}</span><strong>{overall ? "The arena is open." : "Your booth. Your moment."}</strong><p>{overall ? "Complete all three challenges to claim a spot here." : "The first completed challenge starts this leaderboard."}</p></div>; }
function BoothBoard({ id, teams, query }: { id: BoothId; teams: RankedTeam[]; query: string }) {
  const booth = BOOTHS.find(b => b.id === id)!;
  const filtered = teams.filter(t => t.teamName.toLowerCase().includes(query));
  return <section className={`panel booth-panel ${booth.color}`}><div className="booth-top"><span className="booth-icon" aria-hidden="true">{id === "cs" ? "</>" : id === "ai" ? "✳" : "⌘"}</span><span className="label">{id.toUpperCase()} CHALLENGE</span><span className="metric-type">{booth.scoring.type === "duration" ? "TIME BASED" : "POINTS BASED"}</span></div><h3>{booth.name}</h3><p className="booth-subtitle">{booth.subtitle}</p>
    <div className="table-label"><span>TEAM</span><span>SCORE / 1,000</span></div>
    {filtered.length ? <ol className="booth-list">{filtered.map(t => <li key={t.teamId}><Rank value={t.rank}/><span className="team-cell"><strong>{t.teamName}</strong><small>{t.results[id]?.duration !== null ? `${t.results[id]?.duration}s` : `${t.results[id]?.points} game points`}</small></span><Points value={t.score}/></li>)}</ol> : query ? <p className="no-match">No matching teams at this booth.</p> : <Empty/>}
    <div className="booth-footer"><span><i/> {teams.length} teams on the board</span><span>MAX 1,000 PTS</span></div>
  </section>;
}
export function Leaderboard({ displayMode = false }: { displayMode?: boolean }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  const [lastUpdated, setLastUpdated] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    let stopped = false; let fetching = false; let controller: AbortController | undefined;
    async function refresh() {
      if (document.hidden || fetching) return;
      fetching = true;
      controller = new AbortController();
      try {
        const response = await fetch("/api/v1/leaderboards", { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not refresh the standings.");
        if (!stopped) { setData(body); setError(""); setLastUpdated(new Date(body.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })); }
      } catch (e) { if (!stopped && !(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Connection interrupted."); }
      finally { fetching = false; }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { stopped = true; controller?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  useEffect(() => { const update = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  async function toggleScreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { setError("Fullscreen is unavailable in this browser. You can use your browser’s fullscreen shortcut."); }
  }
  const search = query.trim().toLowerCase();
  const overall = data?.boards.overall.filter(t => t.teamName.toLowerCase().includes(search)) ?? [];
  const leader = data?.boards.overall[0];
  return <main className={`shell${displayMode ? " display-mode" : ""}`}>
    <div className="event-line"><span className="eyebrow"><span className="tiny-squares" aria-hidden="true">▪ ▪ ▪ ▪</span> GDG HTU / KICKOFF EVENT</span><span className={`live-pill ${error ? "offline" : ""}`}><i/>{error ? "CONNECTION ISSUE" : data?.demo ? "DEMO PREVIEW" : data?.submissionsOpen === false ? "FINAL STANDINGS" : "LIVE STANDINGS"}</span></div>
    <section className="hero"><div><h1>Three challenges.<br/>One <span>leaderboard.</span><span className="hero-dot">*</span></h1><p>Bring your team. Take on every booth.<br className="desktop-break"/> Make your mark at the GDG HTU kickoff.</p></div><div className="hero-art" aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><span className="art-cross">+</span><span className="art-code">&lt;/&gt;</span><span className="art-star">✳</span><span className="art-spark">✦</span><div className="art-ticket"><span>KICKOFF</span><strong>LEVEL UP<span>↗</span></strong><small>BUILD · CONNECT · COMPETE</small></div></div></section>
    {data?.demo ? <div className="notice demo-notice"><span>✦</span><p><strong>You’re exploring the demo.</strong> These are sample teams. Connect your database to start the real competition.</p><Link href="/guide#setup">Setup guide ↗</Link></div> : null}
    {error ? <div role="alert" className="notice error-notice"><p><strong>{data ? "Showing the last successful standings. " : "Standings are unavailable. "}</strong>{error}</p></div> : null}
    <section className="stats" aria-label="Event statistics"><div><span className="stat-icon">⚑</span><span><strong>{data?.totalTeams ?? "—"}</strong><small>Teams in the arena</small></span></div><div><span className="stat-icon">◎</span><span><strong>{data?.qualifiedTeams ?? "—"}</strong><small>Completed all 3 booths</small></span></div><div><span className="stat-icon">↗</span><span><strong>{data?.totalResults ?? "—"}</strong><small>Challenges completed</small></span></div><div><span className="stat-icon">✧</span><span><strong>3,000 <em>pts</em></strong><small>The perfect run</small></span></div></section>
    <div className="board-toolbar"><div role="group" aria-label="Show leaderboard" className="tabs">{[["all", "All boards"], ["overall", "Overall"], ["cs", "CS"], ["ai", "AI"], ["cys", "CYS"]].map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}</div><div className="toolbar-actions"><Link className="button display-toggle" href={displayMode ? "/" : "/?display=1"}>{displayMode ? "Show header" : "Big-screen mode"}</Link><label className="search"><span aria-hidden="true">⌕</span><input aria-label="Find your team" placeholder="Find your team…" value={query} onChange={e => setQuery(e.target.value)}/>{query ? <button aria-label="Clear search" onClick={() => setQuery("")}>×</button> : null}</label><button className="icon-button" onClick={toggleScreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"} title="Fullscreen">⛶</button></div></div>
    {!data && !error ? <div className="panel loading" role="status">Getting the arena ready<span className="loading-dots">…</span></div> : null}
    {data && (view === "all" || view === "overall") ? <section className="panel overall-panel"><div className="overall-main"><div className="section-title"><div><span className="label">THE BIG PICTURE</span><h2>Overall standings <span className="champion-icon"><Trophy/></span></h2></div><span className="count-chip">{data.qualifiedTeams} qualified</span></div><p className="section-description">Three booths completed. Every point earned.</p><div className="overall-table-wrap"><table className="overall-table"><thead><tr><th scope="col">RANK</th><th scope="col">TEAM</th><th scope="col">CS</th><th scope="col">AI</th><th scope="col">CYS</th><th scope="col">TOTAL</th></tr></thead><tbody>{overall.map(t => <tr key={t.teamId}><td><Rank value={t.rank}/></td><td><span className="overall-team"><Avatar team={t.teamName} place={t.rank}/><strong>{t.teamName}</strong></span></td><td>{t.results.cs?.score}</td><td>{t.results.ai?.score}</td><td>{t.results.cys?.score}</td><td><Points value={t.score}/></td></tr>)}</tbody></table></div>{!overall.length ? search ? <p className="no-match">No qualified teams match “{query}”. Check their booth progress below.</p> : <Empty overall/> : null}</div><aside className="spotlight"><span className="label">{leader ? "CURRENT FRONT-RUNNER" : "YOUR NEXT CHALLENGE"}</span><div className="trophy"><Trophy/><span aria-hidden="true">✦</span></div><span className="spotlight-tag">{leader ? "ON TOP OF THE GAME" : "A SPOT WORTH EARNING"}</span><h3>{leader?.teamName ?? "Make the first move."}</h3>{leader ? <Points value={leader.score}/> : <p>Visit CS, AI, and CYS.<br/>Your overall score starts here.</p>}<div className="completion-chips"><span>✓ CS</span><span>✓ AI</span><span>✓ CYS</span></div><p className="spotlight-note">{leader ? "All three challenges. One impressive run." : "Complete all three to join the overall board."}</p></aside></section> : null}
    {data && view !== "overall" ? <div className={`booth-grid ${view !== "all" ? "single-board" : ""}`}>{BOOTHS.filter(b => view === "all" || view === b.id).map(b => <BoothBoard key={b.id} id={b.id} teams={data.boards[b.id]} query={search}/>)}</div> : null}
    {data ? <section className="progress-panel"><div><span className="label">THE ROAD TO OVERALL</span><h3>{search ? "Your team’s progress" : "Every booth brings you closer."}</h3><p>Teams join the overall leaderboard after completing CS, AI, and CYS.</p></div><div className="progress-teams">{data.teams.filter(t => t.teamName.toLowerCase().includes(search) && (search || t.completed < 3)).slice(0, search ? 10 : 3).map(t => <div key={t.teamId}><strong>{t.teamName}</strong><span className="progress-chips">{BOOTHS.map(b => <span className={t.results[b.id] ? "done" : ""} key={b.id} aria-label={`${b.id.toUpperCase()} ${t.results[b.id] ? "completed" : "pending"}`}>{t.results[b.id] ? "✓ " : "○ "}{b.id.toUpperCase()}</span>)}</span></div>)}{data.teams.every(t => t.completed === 3) && !search ? <p className="muted">Everyone on the board has completed all three. Who’s next?</p> : null}</div></section> : null}
    <footer className="footer"><p>Built for the curious. <span>GDG on Campus HTU.</span></p><span>{lastUpdated ? `Updated ${lastUpdated} · ` : ""}Refreshes every 5s <i/></span></footer>
  </main>;
}
