import { runtimeEnv } from "./runtime-env";

const COOKIE_NAME = "pink_door_voter";
const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function cookieValue(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const chunk of header.split(";")) {
    const [name, ...rest] = chunk.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

function signingSecret(): string {
  const secret = runtimeEnv().COOKIE_SIGNING_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("COOKIE_SIGNING_SECRET is unavailable.");
  }
  return secret;
}

export async function requirePublisher(request: Request): Promise<Response | null> {
  const expected = runtimeEnv().PUBLISH_TOKEN;
  const supplied = request.headers.get("authorization");
  if (
    !expected ||
    expected.length < 24 ||
    !supplied?.startsWith("Bearer ") ||
    !constantTimeEqual(supplied.slice(7), expected)
  ) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}

export type VoterIdentity = {
  voterHash: string;
  rateHash: string;
  setCookie: string | null;
};

export async function voterIdentity(
  request: Request,
  date: string,
): Promise<VoterIdentity> {
  const secret = signingSecret();
  const existing = cookieValue(request);
  let voterId: string | null = null;

  if (existing) {
    const [id, signature] = existing.split(".");
    if (id && signature) {
      const expected = await hmacHex(secret, id);
      if (constantTimeEqual(signature, expected)) voterId = id;
    }
  }

  let setCookie: string | null = null;
  if (!voterId) {
    voterId = crypto.randomUUID();
    const signature = await hmacHex(secret, voterId);
    setCookie = `${COOKIE_NAME}=${voterId}.${signature}; Path=/; Max-Age=172800; HttpOnly; Secure; SameSite=Lax`;
  }

  const forwardedIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";

  return {
    voterHash: await sha256Hex(`${date}:${voterId}`),
    rateHash: await hmacHex(secret, `${date}:${forwardedIp}`),
    setCookie,
  };
}
