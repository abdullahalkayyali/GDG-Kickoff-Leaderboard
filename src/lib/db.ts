import { neon } from "@neondatabase/serverless";
import { AppError } from "./scoring";

export type Query = (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
export function database(): Query {
  const url = process.env.DATABASE_URL;
  if (!url) throw new AppError(503, "Database is not configured. Connect Neon and set DATABASE_URL.");
  const sql = neon(url);
  return async (text, params = []) => await sql.query(text, params) as Record<string, unknown>[];
}
export function demoMode() {
  return process.env.DEMO_MODE === "true" || (!process.env.DATABASE_URL && !process.env.VERCEL && process.env.DEMO_MODE !== "false");
}
