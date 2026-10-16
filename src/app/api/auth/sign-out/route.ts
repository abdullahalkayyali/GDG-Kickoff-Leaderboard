import { errorResponse, json } from "@/lib/http";
import { requireSameOrigin, sessionCookie } from "@/lib/organizer-auth";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const response = json({ signedOut: true });
    response.headers.set("Set-Cookie", sessionCookie(request, "", 0));
    return response;
  } catch (error) { return errorResponse(error); }
}
