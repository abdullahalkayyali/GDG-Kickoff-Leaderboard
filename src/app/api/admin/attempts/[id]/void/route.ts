import { database, demoMode } from "@/lib/db";
import { errorResponse, json, jsonBody } from "@/lib/http";
import { AppError } from "@/lib/scoring";
import { voidAttempt } from "@/lib/store";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (demoMode()) throw new AppError(403, "Demo mode is readonly.");
    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError(400, "Invalid attempt ID.");
    const body = await jsonBody(request) as { reason?: unknown } | null;
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 3 || reason.length > 240) throw new AppError(400, "Provide a correction reason of 3–240 characters.");
    await voidAttempt(database(), id, reason);
    return json({ voided: true });
  } catch (error) { return errorResponse(error); }
}
