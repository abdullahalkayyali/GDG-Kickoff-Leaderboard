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
  const current = await query("SELECT a.score FROM attempts a JOIN teams t ON t.id = a.team_id WHERE t.name_key = $1 AND a.booth = $2 AND a.voided_at IS NULL", [data.teamKey, booth]);
  const id = randomUUID();
  const rows = await query(`WITH team AS (
    INSERT INTO teams(id, name, name_key) VALUES($1, $2, $3)
    ON CONFLICT(name_key) DO UPDATE SET name_key = EXCLUDED.name_key RETURNING id
  ) INSERT INTO attempts(id, team_id, booth, duration, points, score, scoring_version, idempotency_key, fingerprint)
  SELECT $4, team.id, $5, $6, $7, $8, $9, $10, $11 FROM team
  ON CONFLICT (team_id, booth) WHERE voided_at IS NULL DO UPDATE SET
    duration = CASE WHEN EXCLUDED.score > attempts.score THEN EXCLUDED.duration ELSE attempts.duration END,
    points = CASE WHEN EXCLUDED.score > attempts.score THEN EXCLUDED.points ELSE attempts.points END,
    score = GREATEST(attempts.score, EXCLUDED.score),
    scoring_version = CASE WHEN EXCLUDED.score > attempts.score THEN EXCLUDED.scoring_version ELSE attempts.scoring_version END,
    idempotency_key = CASE WHEN EXCLUDED.score > attempts.score AND EXCLUDED.idempotency_key IS NOT NULL THEN EXCLUDED.idempotency_key ELSE attempts.idempotency_key END,
    fingerprint = CASE WHEN EXCLUDED.score > attempts.score THEN EXCLUDED.fingerprint ELSE attempts.fingerprint END
  RETURNING id, score, id = $4 AS created`,
  [randomUUID(), data.teamName, data.teamKey, id, booth, data.duration, data.points, data.score, data.scoringVersion, key, data.fingerprint]);
  const created = Boolean(rows[0].created);
  return { attemptId: String(rows[0].id), score: Number(rows[0].score), created, updated: !created && current.length > 0 && data.score > Number(current[0].score), replayed: false };
}
function replay(row: Record<string, unknown>, data: Submission) {
  if (row.fingerprint !== data.fingerprint) throw new AppError(409, "Idempotency-Key was already used with a different payload.");
  return { attemptId: String(row.id), score: Number(row.score), replayed: true, voided: Boolean(row.voided_at) };
}
export async function deleteAttemptLog(query: Query, id: string) {
  const rows = await query("DELETE FROM attempts WHERE id = $1 AND voided_at IS NOT NULL RETURNING id", [id]);
  if (!rows.length) throw new AppError(404, "Removed log not found. Active scores must be removed first.");
  return { deleted: true };
}

export async function voidAttempt(query: Query, id: string, reason: string) {
  const rows = await query("UPDATE attempts SET voided_at = NOW(), void_reason = $2 WHERE id = $1 AND voided_at IS NULL RETURNING id", [id, reason]);
  if (!rows.length) throw new AppError(404, "Active attempt not found.");
}

export async function renameTeam(query: Query, id: string, teamName: string, teamKey: string) {
  const conflict = await query("SELECT id FROM teams WHERE name_key = $1 AND id <> $2 LIMIT 1", [teamKey, id]);
  if (conflict.length) throw new AppError(409, "Another team already uses that name.");
  try {
    const rows = await query("UPDATE teams SET name = $2, name_key = $3 WHERE id = $1 RETURNING id, name", [id, teamName, teamKey]);
    if (!rows.length) throw new AppError(404, "Team not found.");
    return { teamId: String(rows[0].id), teamName: String(rows[0].name) };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505")
      throw new AppError(409, "Another team already uses that name.");
    throw error;
  }
}

export async function resetLeaderboard(query: Query) {
  // Preserve raw results and replay history; release the active-result uniqueness constraint.
  const rows = await query("UPDATE attempts SET voided_at = NOW(), void_reason = 'Leaderboard reset' WHERE voided_at IS NULL RETURNING id");
  return rows.length;
}
