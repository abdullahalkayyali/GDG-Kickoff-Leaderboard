import { errorResponse, json, jsonBody } from "@/lib/http";
import { checkCredentials, issueSession, requireSameOrigin, sessionCookie } from "@/lib/organizer-auth";
import { AppError } from "@/lib/scoring";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await jsonBody(request) as { username?: unknown; password?: unknown } | null;
    if (!await checkCredentials(body?.username, body?.password)) throw new AppError(401, "Incorrect username or password.");
    const response = json({ signedIn: true });
    response.headers.set("Set-Cookie", sessionCookie(request, await issueSession()));
    return response;
  } catch (error) { return errorResponse(error); }
}
