import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type RuntimeEnv = { DB?: D1Database };

export function getD1(): D1Database {
  const d1 = (env as unknown as RuntimeEnv).DB;
  if (!d1) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure `d1` as `DB` in .openai/hosting.json and apply the generated migration.",
    );
  }
  return d1;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}
