import { createHash } from "node:crypto";
import { type Booth, MAX_POINTS, SCORING_VERSION } from "./config";

export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type Submission = {
  teamName: string; teamKey: string; points: number;
  score: number; scoringVersion: string; fingerprint: string;
};
export function normalizeName(value: unknown) {
  if (typeof value !== "string") throw new AppError(400, "teamName must be a string.");
  const name = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (name.length < 2 || name.length > 48 || /[\p{Cc}\p{Cf}]/u.test(name))
    throw new AppError(400, "Team names must be 2–48 characters without control characters.");
  return { teamName: name, teamKey: name.toLowerCase() };
}
export function parseSubmission(body: unknown, booth: Booth): Submission {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(400, "Expected a JSON object.");
  const data = body as Record<string, unknown>;
  const allowed = new Set(["teamName", "points"]);
  if (Object.keys(data).some(k => !allowed.has(k))) throw new AppError(400, "Send only teamName and points.");
  const names = normalizeName(data.teamName);
  const value = data.points;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > MAX_POINTS)
    throw new AppError(400, `points must be an integer from 0 to ${MAX_POINTS.toLocaleString("en-US")}.`);
  const fingerprint = createHash("sha256").update(JSON.stringify([names.teamKey, booth.id, value])).digest("hex");
  return { ...names, points: value, score: value, scoringVersion: SCORING_VERSION, fingerprint };
}
