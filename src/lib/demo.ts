import { type Result } from "./store";
import { BOOTHS } from "./config";

// Readonly presentation fixtures. Never written to the event database.
// Columns follow BOOTHS: CYS, AI, Doodle Rocket, Coaster Chaser.
export function demoResults(): Result[] {
  const teams: [string, ...(number | null)[]][] = [
    ["Null Pointers", 920, 940, 880, 810], ["Gradient Gang", 880, 980, 720, 900],
    ["Ctrl Alt Elite", 860, 870, 940, 640], ["Byte Me", 700, 820, 610, 780],
    ["The Overfitters", 640, 900, null, null], ["Packet Pirates", 510, 730, 820, 560],
    ["Hello World", null, null, 710, 530], ["Runtime Rebels", 760, null, 740, null],
    ["Neural Nomads", null, 430, null, null], ["Cache Me Outside", 610, null, null, 690]
  ];
  return teams.flatMap(([name, ...values], i) => BOOTHS.flatMap((booth, j) => {
    const value = values[j];
    if (value === null || value === undefined) return [];
    // Neural Nomads has only finished the first of the two AI games.
    const submissions = booth.id === "ai" && name === "Neural Nomads" ? 1 : booth.maxSubmissions;
    return [{ id: `demo-${i}-${j}`, teamId: `team-${i}`, teamName: name, booth: booth.id, points: value, score: value, submissions,
      createdAt: "2026-11-20T12:00:00.000Z", updatedAt: "2026-11-20T12:00:00.000Z", voidedAt: null, voidReason: null }];
  }));
}
