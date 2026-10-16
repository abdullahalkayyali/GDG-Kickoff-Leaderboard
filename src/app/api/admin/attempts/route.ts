import { getBooth } from "@/lib/config";
import { database, demoMode } from "@/lib/db";
import { authenticate, errorResponse, idempotencyKey, json, jsonBody } from "@/lib/http";
import { AppError, parseSubmission } from "@/lib/scoring";
import { readResults, submit } from "@/lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try { authenticate(request, "ADMIN_API_KEY"); return json({ attempts: await readResults(database(), true) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    authenticate(request, "ADMIN_API_KEY");
    if (demoMode()) throw new AppError(403, "Demo mode is readonly.");
    const raw = await jsonBody(request) as Record<string, unknown> | null;
    const booth = getBooth(String(raw?.booth ?? ""));
    if (!booth) throw new AppError(400, "Choose a valid booth.");
    const { booth: ignored, ...body } = raw!; void ignored;
    const saved = await submit(database(), booth.id, parseSubmission(body, booth), idempotencyKey(request));
    return json(saved, saved.replayed ? 200 : 201);
  } catch (error) { return errorResponse(error); }
}
