import { WIPE_CONFIRMATIONS } from "@/lib/config";
import { database, demoMode } from "@/lib/db";
import { errorResponse, json, jsonBody } from "@/lib/http";
import { requireOrganizer } from "@/lib/organizer-auth";
import { AppError } from "@/lib/scoring";
import { wipeLogs, wipeTeams } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireOrganizer(request);
    if (demoMode()) throw new AppError(403, "Demo mode is readonly.");
    const body = await jsonBody(request) as { scope?: unknown; confirmation?: unknown } | null;
    const scope = body?.scope;
    if (scope !== "teams" && scope !== "logs") throw new AppError(400, "Choose teams or logs to wipe.");
    const confirmation = WIPE_CONFIRMATIONS[scope];
    if (body?.confirmation !== confirmation) throw new AppError(400, `Type ${confirmation} to confirm.`);
    const wipe = scope === "teams" ? wipeTeams : wipeLogs;
    await wipe(database());
    return json({ wiped: scope });
  } catch (error) { return errorResponse(error); }
}
