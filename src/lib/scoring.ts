import { createHash } from "node:crypto";
import { type Booth, SCORING_VERSION } from "./config";

export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type Submission = {
  teamName: string; teamKey: string; duration: number | null; points: number | null;
  score: number; scoringVersion: string; fingerprint: string;
};
export function normalizeName(value: unknown) {
  if (typeof value !== "string") throw new AppError(400, "teamName must be a string.");
  const name = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (name.length < 2 || name.length > 48 || /[\p{Cc}\p{Cf}]/u.test(name))
    throw new AppError(400, "Team names must be 2–48 characters without control characters.");
  return { teamName: name, teamKey: name.toLowerCase() };
}
export function calculateScore(booth: Booth, value: number) {
  const s = booth.scoring;
  const fraction = s.type === "duration" ? (s.slow - value) / (s.slow - s.fast) : (value - s.min) / (s.max - s.min);
  return Math.round(1000 * Math.max(0, Math.min(1, fraction)));
}
export function parseSubmission(body: unknown, booth: Booth): Submission {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(400, "Expected a JSON object.");
  const data = body as Record<string, unknown>;
  const allowed = new Set(["teamName", booth.scoring.type]);
  if (Object.keys(data).some(k => !allowed.has(k))) throw new AppError(400, `Send only teamName and ${booth.scoring.type}.`);
  const names = normalizeName(data.teamName);
  const value = data[booth.scoring.type];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000_000 || (booth.scoring.type === "duration" && value === 0))
    throw new AppError(400, `${booth.scoring.type} must be a finite ${booth.scoring.type === "duration" ? "positive number of seconds" : "nonnegative number"} (maximum 1,000,000,000).`);
  const duration = booth.scoring.type === "duration" ? value : null;
  const points = booth.scoring.type === "points" ? value : null;
  const fingerprint = createHash("sha256").update(JSON.stringify([names.teamKey, booth.id, duration, points])).digest("hex");
  return { ...names, duration, points, score: calculateScore(booth, value), scoringVersion: SCORING_VERSION, fingerprint };
}
