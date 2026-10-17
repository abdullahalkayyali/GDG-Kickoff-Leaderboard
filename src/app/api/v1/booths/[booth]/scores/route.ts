import { getBooth } from "@/lib/config";
import { database, demoMode } from "@/lib/db";
import { errorResponse, idempotencyKey, json, jsonBody } from "@/lib/http";
import { AppError, parseSubmission } from "@/lib/scoring";
import { submit } from "@/lib/store";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ booth: string }> }) {
  try {
    const booth = getBooth((await context.params).booth);
    if (!booth) throw new AppError(404, "Unknown booth. Use cs, ai, or cys.");
    if (demoMode()) throw new AppError(403, "Demo mode is readonly. Connect a database and disable DEMO_MODE to submit results.");
    if (process.env.SUBMISSIONS_OPEN === "false") throw new AppError(403, "Event submissions are closed.");
    const data = parseSubmission(await jsonBody(request), booth);
    const saved = await submit(database(), booth.id, data, idempotencyKey(request));
    return json({ ...saved, teamName: data.teamName, booth: booth.id }, "created" in saved && saved.created ? 201 : 200);
  } catch (error) { return errorResponse(error); }
}
