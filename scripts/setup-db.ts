import nextEnv from "@next/env";
import { readFile } from "node:fs/promises";
import { database } from "../src/lib/db";

nextEnv.loadEnvConfig(process.cwd());
const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const query = database();
for (const statement of schema.split(";").map(s => s.trim()).filter(Boolean)) await query(statement);
console.log("Database schema is ready. No existing results were removed.");
