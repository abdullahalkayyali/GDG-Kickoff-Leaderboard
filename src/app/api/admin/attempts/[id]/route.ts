import { database, demoMode } from "@/lib/db";
import { errorResponse, json } from "@/lib/http";
import { AppError } from "@/lib/scoring";
import { deleteAttemptLog } from "@/lib/store";
import { requireOrganizer } from "@/lib/organizer-auth";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireOrganizer(request);
    if (demoMode()) throw new AppError(403, "Demo mode is readonly.");
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new AppError(400, "Invalid attempt ID.");
    return json(await deleteAttemptLog(database(), id));
  } catch (error) { return errorResponse(error); }
}
