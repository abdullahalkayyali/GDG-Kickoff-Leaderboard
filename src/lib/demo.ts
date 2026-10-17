import { type Result } from "./store";
import { BOOTHS } from "./config";

// Readonly presentation fixtures. Never written to the event database.
export function demoResults(): Result[] {
  const teams = [
    ["Null Pointers", 920, 940, 900], ["Gradient Gang", 880, 980, 810],
    ["Ctrl Alt Elite", 860, 870, 870], ["Byte Me", 700, 820, 730],
    ["The Overfitters", 640, 900, 630], ["Packet Pirates", 510, 730, 820],
    ["Hello World", 450, 710, 530], ["Runtime Rebels", 760, null, 740],
    ["Neural Nomads", null, 930, null], ["Cache Me Outside", 610, null, null]
  ] as const;
  return teams.flatMap(([name, ...values], i) => BOOTHS.flatMap((booth, j) => {
    const value = values[j];
    if (value === null) return [];
    return [{ id: `demo-${i}-${j}`, teamId: `team-${i}`, teamName: name, booth: booth.id,
      duration: null, points: value, score: value, createdAt: "2026-10-16T12:00:00.000Z", voidedAt: null, voidReason: null }];
  }));
}
