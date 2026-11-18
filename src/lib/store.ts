import { randomUUID } from "node:crypto";
import { BOOTHS, CLUB_IDS, type BoardId, type Booth, type BoothId } from "./config";
import { type Query } from "./db";
import { AppError, type Submission } from "./scoring";

export type Result = {
  id: string; teamId: string; teamName: string; booth: BoothId;
  points: number; score: number; submissions: number;
  createdAt: string; updatedAt: string; voidedAt: string | null; voidReason: string | null;
};
export type Team = { id: string; name: string };
export type RankedTeam = { teamId: string; teamName: string; score: number; rank: number; results: Partial<Record<BoothId, Result>>; completed: number };
export type Snapshot = {
  boards: Record<BoardId, RankedTeam[]>; teams: RankedTeam[];
  totalTeams: number; totalResults: number; updatedAt: string; demo: boolean; submissionsOpen: boolean;
};
function result(row: Record<string, unknown>): Result {
  return { id: String(row.id), teamId: String(row.team_id), teamName: String(row.team_name), booth: row.booth as BoothId,
    points: Number(row.points), score: Number(row.score), submissions: Number(row.submissions),
    createdAt: new Date(row.created_at as string).toISOString(), updatedAt: new Date(row.updated_at as string).toISOString(),
    voidedAt: row.voided_at ? new Date(row.voided_at as string).toISOString() : null, voidReason: row.void_reason as string | null };
}
export async function readResults(query: Query, includeVoided = false) {
  const rows = await query(`SELECT a.*, t.name AS team_name FROM attempts a JOIN teams t ON t.id = a.team_id ${includeVoided ? "" : "WHERE a.voided_at IS NULL"} ORDER BY a.created_at DESC, a.id`);
  return rows.map(result);
}
export async function readOrganizerData(query: Query) {
  const rows = await query(`SELECT a.*, t.id AS organizer_team_id, t.name AS team_name
    FROM teams t LEFT JOIN attempts a ON a.team_id = t.id
    ORDER BY a.created_at DESC NULLS LAST, a.id`);
  const teams = new Map<string, Team>();
  const attempts: Result[] = [];
  for (const row of rows) {
    const id = String(row.organizer_team_id);
    teams.set(id, { id, name: String(row.team_name) });
    if (row.id !== null) attempts.push(result(row));
  }
  return { teams: [...teams.values()], attempts };
}
function rank(teams: RankedTeam[]) {
  teams.sort((a, b) => b.score - a.score || a.teamName.localeCompare(b.teamName) || a.teamId.localeCompare(b.teamId));
  let previous: number | undefined;
  let position = 0;
  return teams.map((team, index) => { if (team.score !== previous) position = index + 1; previous = team.score; return { ...team, rank: position }; });
}
/** Ranks every team that has at least one score in the given booths by the sum of those booth scores. */
function board(teams: RankedTeam[], booths: Booth[]) {
  return rank(teams.filter(t => booths.some(b => t.results[b.id])).map(t => ({
    ...t, completed: booths.filter(b => t.results[b.id]).length, score: booths.reduce((sum, b) => sum + (t.results[b.id]?.score ?? 0), 0)
  })));
}
export function snapshot(results: Result[], demo = false): Snapshot {
  const grouped = new Map<string, RankedTeam>();
  for (const r of results.filter(r => !r.voidedAt)) {
    const team = grouped.get(r.teamId) ?? { teamId: r.teamId, teamName: r.teamName, score: 0, rank: 0, results: {}, completed: 0 };
    team.results[r.booth] = r;
    grouped.set(r.teamId, team);
  }
  const teams = [...grouped.values()];
  const boards = { overall: board(teams, BOOTHS) } as Record<BoardId, RankedTeam[]>;
  for (const club of CLUB_IDS) boards[club] = board(teams, BOOTHS.filter(b => b.club === club));
  return { boards, teams: [...boards.overall].sort((a, b) => a.teamName.localeCompare(b.teamName)), totalTeams: teams.length,
    totalResults: results.filter(r => !r.voidedAt).length, updatedAt: new Date().toISOString(), demo, submissionsOpen: process.env.SUBMISSIONS_OPEN !== "false" };
}

export type SubmitResult = {
  attemptId: string; score: number; submissions: number; complete: boolean;
  created: boolean; updated: boolean; replayed: boolean; voided?: boolean;
};
/**
 * Records a booth score. Each team gets one play per booth: the first request creates the score and
 * later requests are rejected with 409. Booths with maxSubmissions > 1 (the two-part AI game) may send
 * follow-up requests carrying the running total, which replace the stored score.
 * Organizer entries are always final and never overwrite an active score.
 */
export async function submit(query: Query, booth: Booth, data: Submission, key: string | null, options: { organizer?: boolean } = {}): Promise<SubmitResult> {
  if (key) {
    const old = await query("SELECT id, fingerprint, score, submissions, voided_at FROM attempts WHERE booth = $1 AND idempotency_key = $2", [booth.id, key]);
    if (old.length) return replay(old[0], data, booth);
  }
  const id = randomUUID();
  const insertedSubmissions = options.organizer ? booth.maxSubmissions : 1;
  const updateLimit = options.organizer ? 0 : booth.maxSubmissions;
  const rows = await query(`WITH team AS (
    INSERT INTO teams(id, name, name_key) VALUES($1, $2, $3)
    ON CONFLICT(name_key) DO UPDATE SET name_key = EXCLUDED.name_key RETURNING id
  ) INSERT INTO attempts(id, team_id, booth, points, score, submissions, scoring_version, idempotency_key, fingerprint)
  SELECT $4, team.id, $5, $6, $7, $8, $9, $10, $11 FROM team
  ON CONFLICT (team_id, booth) WHERE voided_at IS NULL DO UPDATE SET
    points = EXCLUDED.points, score = EXCLUDED.score, submissions = attempts.submissions + 1,
    scoring_version = EXCLUDED.scoring_version, fingerprint = EXCLUDED.fingerprint, updated_at = NOW(),
    idempotency_key = COALESCE(EXCLUDED.idempotency_key, attempts.idempotency_key)
  WHERE attempts.submissions < $12 AND EXCLUDED.score >= attempts.score
  RETURNING id, score, submissions, id = $4 AS created`,
  [randomUUID(), data.teamName, data.teamKey, id, booth.id, data.points, data.score, insertedSubmissions, data.scoringVersion, key, data.fingerprint, updateLimit]);
  if (!rows.length) {
    const current = await query("SELECT a.score, a.submissions FROM attempts a JOIN teams t ON t.id = a.team_id WHERE t.name_key = $1 AND a.booth = $2 AND a.voided_at IS NULL", [data.teamKey, booth.id]);
    const existing = current[0];
    if (options.organizer) throw new AppError(409, `${data.teamName} already has a ${booth.name} score. Remove it first, then add the correction.`);
    if (existing && Number(existing.submissions) < booth.maxSubmissions)
      throw new AppError(400, `The ${booth.name} total (${data.score}) can't be lower than the score already recorded (${Number(existing.score)}). Send the running total.`);
    throw new AppError(409, `${data.teamName} already played ${booth.name}. Replays are not allowed.`);
  }
  const created = Boolean(rows[0].created);
  const submissions = Number(rows[0].submissions);
  return { attemptId: String(rows[0].id), score: Number(rows[0].score), submissions, complete: submissions >= booth.maxSubmissions, created, updated: !created, replayed: false };
}
function replay(row: Record<string, unknown>, data: Submission, booth: Booth): SubmitResult {
  if (row.fingerprint !== data.fingerprint) throw new AppError(409, "Idempotency-Key was already used with a different payload.");
  const submissions = Number(row.submissions);
  return { attemptId: String(row.id), score: Number(row.score), submissions, complete: submissions >= booth.maxSubmissions,
    created: false, updated: false, replayed: true, voided: Boolean(row.voided_at) };
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

export async function wipeTeams(query: Query) {
  await query("TRUNCATE TABLE attempts, teams");
}

export async function wipeLogs(query: Query) {
  await query("TRUNCATE TABLE attempts");
}
