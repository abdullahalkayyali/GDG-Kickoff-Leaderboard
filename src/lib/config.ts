export const CLUB_IDS = ["gdg", "gdvc"] as const;
export type ClubId = (typeof CLUB_IDS)[number];

export const BOOTH_IDS = ["cys", "ai", "doodle-rocket", "coaster-chaser"] as const;
export type BoothId = (typeof BOOTH_IDS)[number];
export type BoardId = ClubId | "overall";

export type Booth = {
  id: BoothId; club: ClubId; name: string; short: string;
  /** How many score requests a team may send to this booth. Later requests replace the earlier score. */
  maxSubmissions: number;
};
export type Club = { id: ClubId; name: string; fullName: string; logo: string };

export const MAX_POINTS = 1000;
export const SCORING_VERSION = "ai-open-day-v1";

// Logo files live in /public/logos.
export const EVENT_LOGOS = { host: "/logos/gdg-htu.png", partner: "/logos/elo.png" } as const;

export const CLUBS: Club[] = [
  { id: "gdg", name: "GDG", fullName: "GDG on Campus HTU", logo: "/logos/gdg-htu.png" },
  { id: "gdvc", name: "GDVC", fullName: "GDVC (Game Development VR Club)", logo: "/logos/gdvc.png" }
];

export const BOOTHS: Booth[] = [
  { id: "cys", club: "gdg", name: "Cybersecurity", short: "CYS", maxSubmissions: 1 },
  // The AI booth game has two parts: it first posts game 1's score, then posts game 1 + game 2.
  { id: "ai", club: "gdg", name: "Artificial Intelligence", short: "AI", maxSubmissions: 2 },
  { id: "doodle-rocket", club: "gdvc", name: "Doodle Rocket", short: "DR", maxSubmissions: 1 },
  { id: "coaster-chaser", club: "gdvc", name: "Coaster Chaser", short: "CC", maxSubmissions: 1 }
];

export function getBooth(id: string): Booth | undefined { return BOOTHS.find(b => b.id === id); }
export function getClub(id: ClubId): Club { return CLUBS.find(c => c.id === id)!; }
export function clubBooths(id: ClubId): Booth[] { return BOOTHS.filter(b => b.club === id); }

export const WIPE_CONFIRMATIONS = { teams: "WIPE TEAMS", logs: "WIPE LOGS" } as const;
