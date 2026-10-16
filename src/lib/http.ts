import { AppError } from "./scoring";

export async function jsonBody(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new AppError(415, "Use Content-Type: application/json.");
  if (Number(request.headers.get("content-length")) > 4096) throw new AppError(413, "Payload too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "A JSON body is required.");
  let size = 0; const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 4096) { await reader.cancel(); throw new AppError(413, "Payload too large."); }
    parts.push(value);
  }
  try { return JSON.parse(Buffer.concat(parts).toString("utf8")) as unknown; }
  catch { throw new AppError(400, "Invalid JSON."); }
}
export function idempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key");
  if (key !== null && !/^[A-Za-z0-9_.:-]{1,128}$/.test(key)) throw new AppError(400, "Idempotency-Key must contain 1–128 letters, numbers, or . _ : -");
  return key;
}
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
export function errorResponse(error: unknown) {
  if (error instanceof AppError) return json({ error: error.message }, error.status);
  // Do not log database error objects: they can include connection details or query parameters.
  console.error("Leaderboard operation failed", error instanceof Error ? error.name : "UnknownError");
  return json({ error: "The database is temporarily unavailable. Check its connection and run npm run db:setup if needed." }, 503);
}
