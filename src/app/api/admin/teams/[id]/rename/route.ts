import { database, demoMode } from "@/lib/db";
import { errorResponse, json, jsonBody } from "@/lib/http";
import { requireOrganizer } from "@/lib/organizer-auth";
import { AppError, normalizeName } from "@/lib/scoring";
import { renameTeam } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireOrganizer(request);
    if (demoMode()) throw new AppError(403, "Demo mode is readonly.");
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError(400, "Invalid team ID.");
    const body = await jsonBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AppError(400, "Expected a JSON object.");
    const data = body as Record<string, unknown>;
    if (Object.keys(data).some(key => key !== "teamName")) throw new AppError(400, "Send only teamName.");
    const name = normalizeName(data.teamName);
    return json({ renamed: true, ...(await renameTeam(database(), id, name.teamName, name.teamKey)) });
  } catch (error) { return errorResponse(error); }
}
