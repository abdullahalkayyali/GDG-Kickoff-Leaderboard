import { getBooth } from "@/lib/config";
import { database, demoMode } from "@/lib/db";
import { errorResponse, idempotencyKey, json, jsonBody } from "@/lib/http";
import { demoResults } from "@/lib/demo";
import { AppError, parseSubmission } from "@/lib/scoring";
import { readResults, submit } from "@/lib/store";
import { requireOrganizer } from "@/lib/organizer-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { await requireOrganizer(request); const demo = demoMode(); return json({ attempts: demo ? demoResults() : await readResults(database(), true), demo }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    await requireOrganizer(request);
    if (demoMode()) throw new AppError(403, "Demo mode is readonly.");
    const raw = await jsonBody(request) as Record<string, unknown> | null;
    const booth = getBooth(String(raw?.booth ?? ""));
    if (!booth) throw new AppError(400, "Choose a valid booth.");
    const { booth: ignored, ...body } = raw!; void ignored;
    const data = parseSubmission(body, booth);
    const key = idempotencyKey(request);
    const saved = await submit(database(), booth.id, data, key);
    return json(saved, saved.replayed ? 200 : 201);
  } catch (error) { return errorResponse(error); }
}
