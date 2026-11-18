"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
/* eslint-disable @next/next/no-img-element -- plain <img> so logo files can be swapped for any format. */
import Link from "next/link";
import { BOOTHS, CLUBS, clubBooths, MAX_POINTS, type BoardId, type Booth, type Club } from "@/lib/config";
import type { RankedTeam, Snapshot } from "@/lib/store";
import { LogoLockup } from "./brand";

function Rank({ value }: { value: number }) { return <span className={`lb-rank${value === 1 ? " is-first" : ""}`}>{String(value).padStart(2, "0")}</span>; }
function Score({ value, total = false }: { value: number; total?: boolean }) { return <span className={`lb-score${total ? " is-total" : ""}`}>{value.toLocaleString("en-US")}<small> pts</small></span>; }
function Empty({ searching = false }: { searching?: boolean }) { return <div className="lb-empty"><strong>{searching ? "No matches." : "No scores yet."}</strong></div>; }

type Overtakes = Record<string, number>;
const BOARD_IDS: BoardId[] = ["overall", ...CLUBS.map(club => club.id)];

function overtakeKey(board: BoardId, teamId: string) { return `${board}:${teamId}`; }

function findOvertakes(previous: Snapshot | null, next: Snapshot): Overtakes {
  if (!previous) return {};
  const moves: Overtakes = {};
  for (const board of BOARD_IDS) {
    const oldRanks = new Map((previous.boards[board] ?? []).map(team => [team.teamId, team.rank]));
    for (const team of next.boards[board] ?? []) {
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

function BoothCell({ team, booth }: { team: RankedTeam; booth: Booth }) {
  const result = team.results[booth.id];
  if (!result) return <td className="lb-missing" aria-label="Not played">—</td>;
  const partial = result.submissions < booth.maxSubmissions;
  return <td>{result.score.toLocaleString("en-US")}{partial ? <small className="lb-partial" title={`Game ${result.submissions} of ${booth.maxSubmissions} recorded`}>{result.submissions}/{booth.maxSubmissions}</small> : null}</td>;
}

function StandingsTable({ board, booths, teams, query, overtakes }: { board: BoardId; booths: Booth[]; teams: RankedTeam[]; query: string; overtakes: Overtakes }) {
  const visible = teams.filter(team => team.teamName.toLocaleLowerCase().includes(query));
  return <div className="lb-table-wrap">{visible.length ? <table className={`lb-table lb-table-${booths.length}`}>
    <thead><tr><th scope="col">RANK</th><th scope="col">TEAM</th>{booths.map(booth => <th key={booth.id} scope="col"><abbr title={booth.name}>{booth.short}</abbr></th>)}<th scope="col">TOTAL</th></tr></thead>
    <tbody>{visible.map(team => <tr key={team.teamId} {...overtakeProps(overtakes[overtakeKey(board, team.teamId)])}><td><Rank value={team.rank}/></td><td><strong className="lb-name">{team.teamName}</strong></td>{booths.map(booth => <BoothCell key={booth.id} team={team} booth={booth}/>)}<td><Score value={team.score} total={board === "overall"}/></td></tr>)}</tbody>
  </table> : <Empty searching={Boolean(query)}/>}</div>;
}

function ClubBoard({ club, teams, query, overtakes }: { club: Club; teams: RankedTeam[]; query: string; overtakes: Overtakes }) {
  const booths = clubBooths(club.id);
  return <section className={`lb-booth lb-club lb-${club.id}`} aria-labelledby={`lb-${club.id}-title`}>
    <div className="lb-club-logo"><img src={club.logo} alt={`${club.fullName} logo`}/></div>
    <div className="lb-booth-heading"><div><h3 id={`lb-${club.id}-title`}>{club.name} booths</h3><span className="lb-club-games">{booths.map(booth => booth.name).join(" + ")}</span></div><span className="lb-count">out of {(booths.length * MAX_POINTS).toLocaleString("en-US")}</span></div>
    <StandingsTable board={club.id} booths={booths} teams={teams} query={query} overtakes={overtakes}/>
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
  return <main className={`leaderboard-page${displayMode ? " is-display" : ""}`}>
    <div className="lb-background" aria-hidden="true"><i/><i/><i/></div>
    <div className="lb-content">
      <div className="lb-topline"><span className="lb-event"><span className="lb-color-bars" aria-hidden="true"><i/><i/><i/><i/></span>GDG HTU × ELO</span><span className={`lb-status${error ? " has-error" : ""}`}><i/>{error ? "Connection issue" : data?.demo ? "Demo preview" : data?.submissionsOpen === false ? "Final standings" : "Live standings"}</span></div>
      <div className="lb-intro"><h1>AI Open Day<span className="lb-period">.</span></h1><LogoLockup className="lb-lockup"/></div>
      <div className="lb-controls"><div className="lb-rule"><span className="lb-rule-icon" aria-hidden="true">✦</span><span>Every game is scored out of <strong>{MAX_POINTS.toLocaleString("en-US")}</strong>. <strong>One play per game</strong>: no replays.</span></div><div className="lb-actions"><label className="lb-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg><input aria-label="Find a team" placeholder="Find a team" value={query} onChange={event => setQuery(event.target.value)}/>{query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")}>×</button> : null}</label><Link className="lb-action" href={displayMode ? "/" : "/?display=1"}>{displayMode ? "Standard view" : "Big screen"}<span aria-hidden="true">↗</span></Link><button type="button" className="lb-action lb-fullscreen" onClick={toggleScreen} aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}>{fullscreen ? "Exit fullscreen" : "Fullscreen"}<span aria-hidden="true">⛶</span></button></div></div>
      {error ? <div role="alert" className="lb-alert">{data ? "Showing the last available standings. " : "Standings are unavailable. "}{error}</div> : null}
      {data?.demo ? <div className="lb-alert">Demo preview: these are sample teams.</div> : null}
      {!data && !error ? <div className="lb-loading" role="status">Loading standings…</div> : null}
      {data ? <div className="lb-boards">
        <section className="lb-overall" aria-labelledby="lb-overall-title"><div className="lb-overall-head"><h2 id="lb-overall-title">Overall standings</h2><span className="lb-count">All four games · out of {(BOOTHS.length * MAX_POINTS).toLocaleString("en-US")}</span></div>
          <StandingsTable board="overall" booths={BOOTHS} teams={data.boards.overall} query={search} overtakes={overtakes}/>
        </section>
        <div className="lb-booth-grid lb-club-grid">{CLUBS.map(club => <ClubBoard key={club.id} club={club} teams={data.boards[club.id]} query={search} overtakes={overtakes}/>)}</div>
      </div> : null}
    </div>
  </main>;
}
