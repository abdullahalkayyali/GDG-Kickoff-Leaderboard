export const BOOTH_IDS = ["cs", "ai", "cys"] as const;
export type BoothId = (typeof BOOTH_IDS)[number];
export type Scoring =
  | { type: "duration"; fast: number; slow: number }
  | { type: "points"; min: number; max: number };
export type Booth = { id: BoothId; name: string; subtitle: string; color: string; scoring: Scoring };

// Calibrate with practice runs BEFORE the event. Duration is always in seconds.
// Freeze this configuration once real submissions begin. Bump the version if changed.
export const SCORING_VERSION = "kickoff-v1";
export const BOOTHS: Booth[] = [
  { id: "cs", name: "Computer Science", subtitle: "Think. Solve. Execute.", color: "blue", scoring: { type: "duration", fast: 30, slow: 150 } },
  { id: "ai", name: "Artificial Intelligence", subtitle: "Train your competitive edge.", color: "yellow", scoring: { type: "points", min: 0, max: 100 } },
  { id: "cys", name: "Cybersecurity", subtitle: "Crack the challenge.", color: "green", scoring: { type: "duration", fast: 45, slow: 180 } }
];
export function getBooth(id: string): Booth | undefined { return BOOTHS.find(b => b.id === id); }
