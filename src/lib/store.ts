import { randomUUID } from "node:crypto";
import { BOOTH_IDS, type BoothId } from "./config";
import { type Query } from "./db";
import { AppError, type Submission } from "./scoring";

export type Result = {
  id: string; teamId: string; teamName: string; booth: BoothId;
  duration: number | null; points: number | null; score: number;
  createdAt: string; voidedAt: string | null; voidReason: string | null;
};
export type RankedTeam = { teamId: string; teamName: string; score: number; rank: number; results: Partial<Record<BoothId, Result>>; completed: number };
export type Snapshot = {
  boards: Record<BoothId | "overall", RankedTeam[]>; teams: RankedTeam[];
  totalTeams: number; qualifiedTeams: number; totalResults: number; updatedAt: string; demo: boolean; submissionsOpen: boolean;
};
function result(row: Record<string, unknown>): Result {
  return { id: String(row.id), teamId: String(row.team_id), teamName: String(row.team_name), booth: row.booth as BoothId,
    duration: row.duration === null ? null : Number(row.duration), points: row.points === null ? null : Number(row.points),
    score: Number(row.score), createdAt: new Date(row.created_at as string).toISOString(),
    voidedAt: row.voided_at ? new Date(row.voided_at as string).toISOString() : null, voidReason: row.void_reason as string | null };
}
export async function readResults(query: Query, includeVoided = false) {
  const rows = await query(`SELECT a.*, t.name AS team_name FROM attempts a JOIN teams t ON t.id = a.team_id ${includeVoided ? "" : "WHERE a.voided_at IS NULL"} ORDER BY a.created_at DESC, a.id`);
  return rows.map(result);
}
function rank(teams: RankedTeam[]) {
  teams.sort((a, b) => b.score - a.score || a.teamName.localeCompare(b.teamName) || a.teamId.localeCompare(b.teamId));
  let previous: number | undefined;
  let position = 0;
  return teams.map((team, index) => { if (team.score !== previous) position = index + 1; previous = team.score; return { ...team, rank: position }; });
}
export function snapshot(results: Result[], demo = false): Snapshot {
  const grouped = new Map<string, RankedTeam>();
  for (const r of results.filter(r => !r.voidedAt)) {
    const team = grouped.get(r.teamId) ?? { teamId: r.teamId, teamName: r.teamName, score: 0, rank: 0, results: {}, completed: 0 };
    team.results[r.booth] = r;
    grouped.set(r.teamId, team);
  }
  const teams = [...grouped.values()].map(t => ({ ...t, completed: BOOTH_IDS.filter(id => t.results[id]).length, score: BOOTH_IDS.reduce((sum, id) => sum + (t.results[id]?.score ?? 0), 0) }));
  const overall = rank(teams.filter(t => t.completed === 3));
  return { boards: { overall, cs: rank(teams.filter(t => t.results.cs).map(t => ({ ...t, score: t.results.cs!.score }))), ai: rank(teams.filter(t => t.results.ai).map(t => ({ ...t, score: t.results.ai!.score }))), cys: rank(teams.filter(t => t.results.cys).map(t => ({ ...t, score: t.results.cys!.score }))) },
    teams: teams.sort((a, b) => a.teamName.localeCompare(b.teamName)), totalTeams: teams.length, qualifiedTeams: overall.length,
    totalResults: results.filter(r => !r.voidedAt).length, updatedAt: new Date().toISOString(), demo, submissionsOpen: process.env.SUBMISSIONS_OPEN !== "false" };
}
export async function submit(query: Query, booth: BoothId, data: Submission, key: string | null) {
  if (key) {
    const old = await query("SELECT id, fingerprint, score, voided_at FROM attempts WHERE booth = $1 AND idempotency_key = $2", [booth, key]);
    if (old.length) return replay(old[0], data);
  }
  const id = randomUUID();
  const rows = await query(`WITH team AS (
    INSERT INTO teams(id, name, name_key) VALUES($1, $2, $3)
    ON CONFLICT(name_key) DO UPDATE SET name_key = EXCLUDED.name_key RETURNING id
  ) INSERT INTO attempts(id, team_id, booth, duration, points, score, scoring_version, idempotency_key, fingerprint)
  SELECT $4, team.id, $5, $6, $7, $8, $9, $10, $11 FROM team
  ON CONFLICT DO NOTHING RETURNING id, score`,
  [randomUUID(), data.teamName, data.teamKey, id, booth, data.duration, data.points, data.score, data.scoringVersion, key, data.fingerprint]);
  if (!rows.length) {
    if (key) {
      const old = await query("SELECT id, fingerprint, score, voided_at FROM attempts WHERE booth = $1 AND idempotency_key = $2", [booth, key]);
      if (old.length) return replay(old[0], data);
    }
    throw new AppError(409, "This team already has a result at this booth. Ask an organizer to void it before resubmitting.");
  }
  return { attemptId: String(rows[0].id), score: Number(rows[0].score), replayed: false };
}
function replay(row: Record<string, unknown>, data: Submission) {
  if (row.fingerprint !== data.fingerprint) throw new AppError(409, "Idempotency-Key was already used with a different payload.");
  return { attemptId: String(row.id), score: Number(row.score), replayed: true, voided: Boolean(row.voided_at) };
}
export async function voidAttempt(query: Query, id: string, reason: string) {
  const rows = await query("UPDATE attempts SET voided_at = NOW(), void_reason = $2 WHERE id = $1 AND voided_at IS NULL RETURNING id", [id, reason]);
  if (!rows.length) throw new AppError(404, "Active attempt not found.");
}
