"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { BOOTHS, type BoothId } from "@/lib/config";
import type { RankedTeam, Snapshot } from "@/lib/store";

const names: Record<BoothId, string> = { cs: "Computer Science", ai: "Artificial Intelligence", cys: "Cybersecurity" };
function Rank({ value }: { value: number }) { return <span className={`lb-rank${value === 1 ? " is-first" : ""}`}>{String(value).padStart(2, "0")}</span>; }
function Score({ value, total = false }: { value: number; total?: boolean }) { return <span className={`lb-score${total ? " is-total" : ""}`}>{value.toLocaleString("en-US")}<small> pts</small></span>; }
function Empty({ searching = false }: { searching?: boolean }) { return <div className="lb-empty"><strong>{searching ? "No matches." : "No scores yet."}</strong></div>; }

type Overtakes = Record<string, number>;

function overtakeKey(board: BoothId | "overall", teamId: string) { return `${board}:${teamId}`; }

function findOvertakes(previous: Snapshot | null, next: Snapshot): Overtakes {
  if (!previous) return {};
  const moves: Overtakes = {};
  for (const board of ["overall", ...BOOTHS.map(booth => booth.id)] as const) {
    const oldRanks = new Map(previous.boards[board].map(team => [team.teamId, team.rank]));
    for (const team of next.boards[board]) {
      const oldRank = oldRanks.get(team.teamId);
      if (oldRank !== undefined && team.rank < oldRank) moves[overtakeKey(board, team.teamId)] = oldRank - team.rank;
    }
  }
  return moves;
}

function overtakeProps(jumps = 0) {
  return jumps ? {
    className: "is-overtaking",
    style: { "--overtake-distance": `${Math.min(72, 18 + jumps * 12)}px` } as CSSProperties
  } : {};
}

function BoothBoard({ id, teams, query, overtakes }: { id: BoothId; teams: RankedTeam[]; query: string; overtakes: Overtakes }) {
  const visible = teams.filter(team => team.teamName.toLocaleLowerCase().includes(query));
  return <section className={`lb-booth lb-${id}`} aria-labelledby={`lb-${id}-title`}>
    <div className="lb-booth-heading"><span className="lb-booth-mark" aria-hidden="true">{id.toUpperCase()}</span><h3 id={`lb-${id}-title`}>{names[id]}</h3></div>
    <div className="lb-booth-labels"><span>TEAM</span><span>SCORE</span></div>
    {visible.length ? <ol className="lb-booth-list">{visible.map(team => <li key={team.teamId} {...overtakeProps(overtakes[overtakeKey(id, team.teamId)])}><Rank value={team.rank}/><span className="lb-booth-team"><strong>{team.teamName}</strong></span><Score value={team.score}/></li>)}</ol> : <Empty searching={Boolean(query)}/>}
  </section>;
}

export function Leaderboard({ displayMode = false }: { displayMode?: boolean }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [overtakes, setOvertakes] = useState<Overtakes>({});
  const dataRef = useRef<Snapshot | null>(null);
  const animationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let stopped = false; let fetching = false; let controller: AbortController | undefined;
    async function refresh() {
      if (document.hidden || fetching) return;
      fetching = true; controller = new AbortController();
      try {
        const response = await fetch("/api/v1/leaderboards", { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not refresh the standings.");
        if (!stopped) {
          const next = body as Snapshot;
          const moves = findOvertakes(dataRef.current, next);
          dataRef.current = next;
          setData(next);
          setOvertakes(moves);
          if (animationTimer.current) clearTimeout(animationTimer.current);
          if (Object.keys(moves).length) animationTimer.current = setTimeout(() => setOvertakes({}), 2300);
          setError("");
        }
      } catch (cause) { if (!stopped && !(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Connection interrupted."); }
      finally { fetching = false; }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { stopped = true; controller?.abort(); clearInterval(timer); if (animationTimer.current) clearTimeout(animationTimer.current); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  useEffect(() => { const update = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); }, []);
  async function toggleScreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { setError("Fullscreen is unavailable in this browser. You can use your browser’s fullscreen shortcut."); } }
  const search = query.trim().toLocaleLowerCase();
  const overall = data?.boards.overall.filter(team => team.teamName.toLocaleLowerCase().includes(search)) ?? [];
  return <main className={`leaderboard-page${displayMode ? " is-display" : ""}`}>
    <div className="lb-background" aria-hidden="true"><i/><i/><i/></div>
    <div className="lb-content">
      <div className="lb-topline"><span className="lb-event"><span className="lb-color-bars" aria-hidden="true"><i/><i/><i/><i/></span>GDG HTU</span><span className={`lb-status${error ? " has-error" : ""}`}><i/>{error ? "Connection issue" : data?.demo ? "Demo preview" : data?.submissionsOpen === false ? "Final standings" : "Live standings"}</span></div>
      <div className="lb-intro"><h1>Leaderboards<span className="lb-period">.</span></h1></div>
      <div className="lb-controls"><div className="lb-rule"><span className="lb-rule-icon" aria-hidden="true">✦</span><span>Complete <strong>CS, AI, and CYS</strong> to join the overall leaderboard.</span></div><div className="lb-actions"><label className="lb-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg><input aria-label="Find a team" placeholder="Find a team" value={query} onChange={event => setQuery(event.target.value)}/>{query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button> : null}</label><Link className="lb-action" href={displayMode ? "/" : "/?display=1"}>{displayMode ? "Standard view" : "Big screen"}<span aria-hidden="true">↗</span></Link><button type="button" className="lb-action lb-fullscreen" onClick={toggleScreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>{fullscreen ? "Exit fullscreen" : "Fullscreen"}<span aria-hidden="true">⛶</span></button></div></div>
      {error ? <div role="alert" className="lb-alert">{data ? "Showing the last available standings. " : "Standings are unavailable. "}{error}</div> : null}
      {data?.demo ? <div className="lb-alert">Demo preview: these are sample teams.</div> : null}
      {!data && !error ? <div className="lb-loading" role="status">Loading standings…</div> : null}
      {data ? <div className="lb-boards">
        <section className="lb-overall" aria-labelledby="lb-overall-title"><div className="lb-overall-head"><h2 id="lb-overall-title">Overall standings</h2></div>
          <div className="lb-table-wrap">{overall.length ? <table className="lb-table"><thead><tr><th scope="col">RANK</th><th scope="col">TEAM</th><th scope="col">CS</th><th scope="col">AI</th><th scope="col">CYS</th><th scope="col">TOTAL</th></tr></thead><tbody>{overall.map(team => <tr key={team.teamId} {...overtakeProps(overtakes[overtakeKey("overall", team.teamId)])}><td><Rank value={team.rank}/></td><td><strong className="lb-name">{team.teamName}</strong></td><td>{team.results.cs?.score.toLocaleString("en-US")}</td><td>{team.results.ai?.score.toLocaleString("en-US")}</td><td>{team.results.cys?.score.toLocaleString("en-US")}</td><td><Score value={team.score} total/></td></tr>)}</tbody></table> : <Empty searching={Boolean(search)}/>}</div>
        </section>
        <div className="lb-booth-grid">{BOOTHS.map(booth => <BoothBoard key={booth.id} id={booth.id} teams={data.boards[booth.id]} query={search} overtakes={overtakes}/>)}</div>
      </div> : null}
    </div>
  </main>;
}
