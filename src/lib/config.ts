export const BOOTH_IDS = ["cs", "ai", "cys"] as const;
export type BoothId = (typeof BOOTH_IDS)[number];
export type Booth = { id: BoothId; name: string; subtitle: string; color: string };

export const SCORING_VERSION = "direct-points-v1";
export const BOOTHS: Booth[] = [
  { id: "cs", name: "Computer Science", subtitle: "Think. Solve. Execute.", color: "blue" },
  { id: "ai", name: "Artificial Intelligence", subtitle: "Train your competitive edge.", color: "yellow" },
  { id: "cys", name: "Cybersecurity", subtitle: "Crack the challenge.", color: "green" }
];
export function getBooth(id: string): Booth | undefined { return BOOTHS.find(b => b.id === id); }
