import { env } from "cloudflare:workers";

type PinkDoorEnv = {
  DB: D1Database;
  SOCIAL_ASSETS?: R2Bucket;
  PUBLISH_TOKEN?: string;
  COOKIE_SIGNING_SECRET?: string;
};

export function runtimeEnv(): PinkDoorEnv {
  return env as unknown as PinkDoorEnv;
}

export function rawDb(): D1Database {
  const database = runtimeEnv().DB;
  if (!database) {
    throw new Error("The DB binding is unavailable.");
  }
  return database;
}

export function socialAssets(): R2Bucket | null {
  return runtimeEnv().SOCIAL_ASSETS ?? null;
}
