import { drizzle } from "drizzle-orm/d1";
import { runtimeEnv } from "@/lib/runtime-env";
import * as schema from "./schema";

export function getDb() {
  return drizzle(runtimeEnv().DB, { schema });
}
