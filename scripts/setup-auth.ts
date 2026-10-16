import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";

if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log("Ready for organizer credentials JSON on stdin (input is hidden).");
let input = "";
for await (const chunk of process.stdin) { input += chunk.toString(); if (input.includes("\n") || input.includes("\r")) break; }
if (process.stdin.isTTY) process.stdin.setRawMode(false);
process.stdin.pause();
const { username, password } = JSON.parse(input);
if (typeof username !== "string" || !username || username.length > 128 || typeof password !== "string" || !password || password.length > 256)
  throw new Error("Provide a username and password in a JSON object.");
const salt = randomBytes(16).toString("hex");
const derived = await promisify(scrypt)(password, salt, 64) as Buffer;
const variables = {
  ORGANIZER_USERNAME: username,
  ORGANIZER_PASSWORD_HASH: `scrypt:${salt}:${derived.toString("hex")}`,
  ORGANIZER_SESSION_SECRET: randomBytes(32).toString("base64url")
};
let env = await readFile(".env.local", "utf8").catch(() => "");
for (const [key, value] of Object.entries(variables)) {
  const line = `${key}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, () => line) : `${env.trimEnd()}\n${line}\n`;
}
await writeFile(".env.local", env);
console.log("Organizer username, password hash, and session secret configured in ignored .env.local. Secret values are hidden.");
