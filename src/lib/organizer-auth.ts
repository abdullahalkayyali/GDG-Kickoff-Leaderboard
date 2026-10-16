import { createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { AppError } from "./scoring";

export const SESSION_COOKIE = "gdg_organizer";
export const SESSION_SECONDS = 12 * 60 * 60;
const deriveKey = promisify(scrypt);

function configuration() {
  const username = process.env.ORGANIZER_USERNAME;
  const passwordHash = process.env.ORGANIZER_PASSWORD_HASH;
  const secret = process.env.ORGANIZER_SESSION_SECRET;
  if (!username || !passwordHash?.match(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/) || !secret || secret.length < 32)
    throw new AppError(503, "Organizer sign-in is not configured.");
  return { username, passwordHash, secret: new TextEncoder().encode(secret),
    version: createHash("sha256").update(`${username}:${passwordHash}`).digest("hex") };
}

export async function checkCredentials(username: unknown, password: unknown) {
  if (typeof username !== "string" || typeof password !== "string" || username.length > 128 || password.length > 256) return false;
  const config = configuration();
  const [, salt, expected] = config.passwordHash.split(":");
  const derived = await deriveKey(password, salt, 64) as Buffer;
  const userMatches = timingSafeEqual(createHash("sha256").update(username).digest(), createHash("sha256").update(config.username).digest());
  return timingSafeEqual(derived, Buffer.from(expected, "hex")) && userMatches;
}

export async function issueSession() {
  const config = configuration();
  return new SignJWT({ role: "organizer", version: config.version })
    .setProtectedHeader({ alg: "HS256" }).setIssuer("gdg-htu-kickoff").setAudience("organizer")
    .setIssuedAt().setExpirationTime(`${SESSION_SECONDS}s`).sign(config.secret);
}

export async function validSession(token: string | undefined) {
  if (!token || token.length > 2048) return false;
  try {
    const config = configuration();
    const { payload } = await jwtVerify(token, config.secret, { algorithms: ["HS256"], issuer: "gdg-htu-kickoff", audience: "organizer", maxTokenAge: `${SESSION_SECONDS}s` });
    return payload.role === "organizer" && payload.version === config.version;
  } catch { return false; }
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ?? url.protocol.slice(0, -1);
  let originMatches = !origin;
  try { if (origin) { const source = new URL(origin); originMatches = source.host === host && source.protocol === `${protocol}:`; } }
  catch { originMatches = false; }
  if (!originMatches || request.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError(403, "Organizer requests must come from this website.");
}

export async function requireOrganizer(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!await validSession(token)) throw new AppError(401, "Please sign in to the organizer console.");
  if (request.method !== "GET" && request.method !== "HEAD") requireSameOrigin(request);
}

export function sessionCookie(request: Request, token: string, maxAge = SESSION_SECONDS) {
  const secure = new URL(request.url).protocol === "https:" || process.env.VERCEL === "1";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
