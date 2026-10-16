import { database, demoMode } from "@/lib/db";
import { demoResults } from "@/lib/demo";
import { errorResponse, json } from "@/lib/http";
import { readResults, snapshot } from "@/lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { const demo = demoMode(); return json(snapshot(demo ? demoResults() : await readResults(database()), demo)); }
  catch (error) { return errorResponse(error); }
}
