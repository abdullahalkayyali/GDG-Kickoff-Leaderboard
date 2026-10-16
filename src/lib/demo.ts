import { type Result } from "./store";
import { BOOTHS } from "./config";
import { calculateScore } from "./scoring";

// Readonly presentation fixtures. Never written to the event database.
export function demoResults(): Result[] {
  const teams = [
    ["Null Pointers", 42, 94, 58], ["Gradient Gang", 51, 98, 70],
    ["Ctrl Alt Elite", 47, 87, 63], ["Byte Me", 66, 82, 81],
    ["The Overfitters", 73, 90, 95], ["Packet Pirates", 89, 73, 69],
    ["Hello World", 96, 71, 108], ["Runtime Rebels", 58, null, 77],
    ["Neural Nomads", null, 93, null], ["Cache Me Outside", 64, null, null]
  ] as const;
  return teams.flatMap(([name, ...values], i) => BOOTHS.flatMap((booth, j) => {
    const value = values[j];
    if (value === null) return [];
    return [{ id: `demo-${i}-${j}`, teamId: `team-${i}`, teamName: name, booth: booth.id,
      duration: booth.scoring.type === "duration" ? value : null, points: booth.scoring.type === "points" ? value : null,
      score: calculateScore(booth, value), createdAt: "2026-10-16T12:00:00.000Z", voidedAt: null, voidReason: null }];
  }));
}
