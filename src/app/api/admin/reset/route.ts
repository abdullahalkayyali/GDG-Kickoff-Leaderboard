import { database, demoMode } from "@/lib/db";
import { errorResponse, json, jsonBody } from "@/lib/http";
import { AppError } from "@/lib/scoring";
import { resetLeaderboard } from "@/lib/store";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await jsonBody(request) as { confirmation?: unknown } | null;
    if (body?.confirmation !== "RESET") throw new AppError(400, "Type RESET to confirm clearing all four leaderboards.");
    if (demoMode()) throw new AppError(403, "Demo mode is readonly.");
    const removed = await resetLeaderboard(database());
    return json({ reset: true, removed });
  } catch (error) { return errorResponse(error); }
}
