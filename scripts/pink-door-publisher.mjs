#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { pollTiming } from "./poll-timing.mjs";

const KEYCHAIN_ACCOUNT = "festavia-theme-site";
const KEYCHAIN_SERVICE = "festavia-theme-site-publisher";

function usage() {
  console.error(
    "Usage: pink-door-publisher.mjs <poll|result|theme|social-poll|social-theme|notifications|ack-notification> <YYYY-MM-DD> [payload-or-image]",
  );
  process.exit(2);
}

async function siteBaseUrl() {
  if (process.env.PINK_DOOR_SITE_URL) {
    return process.env.PINK_DOOR_SITE_URL.replace(/\/$/, "");
  }
  try {
    const config = JSON.parse(
      await readFile(new URL("../publisher.config.json", import.meta.url), "utf8"),
    );
    if (typeof config.baseUrl === "string" && config.baseUrl.startsWith("https://")) {
      return config.baseUrl.replace(/\/$/, "");
    }
  } catch {
    // A clear error is reported below.
  }
  throw new Error("The public site URL is not configured.");
}

function publisherToken() {
  return execFileSync(
    "security",
    [
      "find-generic-password",
      "-w",
      "-a",
      KEYCHAIN_ACCOUNT,
      "-s",
      KEYCHAIN_SERVICE,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim();
}

async function requestWithRetry(url, init, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? `Site returned HTTP ${response.status}.`);
      }
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}

const [operation, date, payloadPath] = process.argv.slice(2);
if (
  !["poll", "result", "theme", "social-poll", "social-theme", "notifications", "ack-notification"].includes(
    operation,
  ) ||
  !date
) {
  usage();
}
if (
  ["poll", "theme", "social-poll", "social-theme", "ack-notification"].includes(operation) &&
  !payloadPath
) {
  usage();
}

const baseUrl = await siteBaseUrl();
const token = publisherToken();
const headers = { Authorization: `Bearer ${token}` };

let endpoint;
let init;
if (operation === "result" || operation === "notifications") {
  endpoint =
    operation === "result"
      ? `/api/admin/polls/${date}/result`
      : `/api/admin/polls/${date}/notifications`;
  init = { method: "GET", headers };
} else if (operation === "social-poll" || operation === "social-theme") {
  const kind = operation === "social-poll" ? "poll" : "theme";
  endpoint = `/api/admin/social/${date}/${kind}`;
  init = {
    method: "PUT",
    headers: { ...headers, "Content-Type": "image/png" },
    body: await readFile(payloadPath),
  };
} else {
  const parsedPayload = JSON.parse(await readFile(payloadPath, "utf8"));
  const payload = JSON.stringify(
    operation === "poll"
      ? { ...parsedPayload, ...pollTiming(date) }
      : parsedPayload,
  );
  endpoint =
    operation === "poll"
      ? `/api/admin/polls/${date}`
      : operation === "theme"
        ? `/api/admin/themes/${date}`
        : `/api/admin/polls/${date}/notifications`;
  init = {
    method: operation === "ack-notification" ? "POST" : "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: payload,
  };
}

const result = await requestWithRetry(`${baseUrl}${endpoint}`, init);
process.stdout.write(`${JSON.stringify(result)}\n`);
