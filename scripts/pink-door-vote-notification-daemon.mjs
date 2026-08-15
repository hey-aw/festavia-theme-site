#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";

const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DISCORD_STATE_DIR =
  process.env.DISCORD_STATE_DIR ??
  join(homedir(), ".codex", "channels", "discord-codex");
const DAEMON_STATE_DIR =
  process.env.PINK_DOOR_DAEMON_STATE_DIR ??
  join(
    homedir(),
    ".codex",
    "daemons",
    "pink-door-discord-vote-notifications",
  );
const STATE_FILE = join(DAEMON_STATE_DIR, "state.json");
const HEALTH_FILE = join(DAEMON_STATE_DIR, "health.json");
const PUBLISHER_CONFIG = join(PROJECT_DIR, "publisher.config.json");
const POLL_INTERVAL_MS = Math.max(
  5_000,
  Number(process.env.PINK_DOOR_NOTIFICATION_INTERVAL_MS ?? 30_000),
);

const KEYCHAIN_ACCOUNT = "festavia-theme-site";
const KEYCHAIN_SERVICE = "festavia-theme-site-publisher";
const DISCORD_API = "https://discord.com/api/v10";

function ensureStateDirectory() {
  mkdirSync(DAEMON_STATE_DIR, { recursive: true, mode: 0o700 });
  chmodSync(DAEMON_STATE_DIR, 0o700);
}

function writePrivateJson(path, value) {
  ensureStateDirectory();
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporary, path);
  chmodSync(path, 0o600);
}

export function normalizeDaemonState(value) {
  const candidate =
    typeof value === "object" && value !== null ? value : {};
  const sent = Array.isArray(candidate.sentUnacknowledged)
    ? candidate.sentUnacknowledged.filter(
        (eventId) =>
          typeof eventId === "string" &&
          /^[0-9a-f-]{36}$/i.test(eventId),
      )
    : [];
  return {
    sentUnacknowledged: [...new Set(sent)],
    lastSuccessfulDelivery:
      typeof candidate.lastSuccessfulDelivery === "string"
        ? candidate.lastSuccessfulDelivery
        : null,
    pollOpenedDate:
      typeof candidate.pollOpenedDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(candidate.pollOpenedDate)
        ? candidate.pollOpenedDate
        : null,
    pollClosedDate:
      typeof candidate.pollClosedDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(candidate.pollClosedDate)
        ? candidate.pollClosedDate
        : null,
  };
}

function loadState() {
  try {
    return normalizeDaemonState(JSON.parse(readFileSync(STATE_FILE, "utf8")));
  } catch {
    return normalizeDaemonState(null);
  }
}

function saveState(state) {
  writePrivateJson(STATE_FILE, normalizeDaemonState(state));
}

function writeHealth(value) {
  writePrivateJson(HEALTH_FILE, {
    updatedAt: new Date().toISOString(),
    ...value,
  });
}

export function pacificDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function voteLabel(count) {
  return `${count} ${count === 1 ? "vote" : "votes"}`;
}

export function formatDiscordMessage(event) {
  return [
    "New Pink Door vote",
    `Date: ${event.date}`,
    `Choice: ${event.observanceName}`,
    `Current tally: ${voteLabel(event.candidateVoteCount)} for this choice, ${voteLabel(event.totalVoteCount)} total`,
    "Voting closes: 5:50 PM Pacific",
  ].join("\n");
}

export function pollPhase(now, poll) {
  const nowMs = now.getTime();
  if (nowMs < Date.parse(poll.opensAt)) return "scheduled";
  if (nowMs < Date.parse(poll.closesAt)) return "open";
  return "closed";
}

export function formatPollOpenedMessage(poll, baseUrl) {
  return [
    "Pink Door voting is open",
    "Today's choices:",
    `- ${poll.winner.observanceName}`,
    `- ${poll.alternate.observanceName}`,
    "Voting closes: 5:50 PM Pacific",
    `Vote: ${baseUrl}`,
  ].join("\n");
}

export function formatPollClosedMessage(poll) {
  const tied = poll.winner.voteCount === poll.alternate.voteCount;
  const outcome =
    poll.totalVoteCount === 0
      ? `No votes were cast; today's preference selected ${poll.winner.observanceName}.`
      : tied
        ? `The vote tied; today's preference selected ${poll.winner.observanceName}.`
        : `Winning choice: ${poll.winner.observanceName}`;
  return [
    "Pink Door voting is closed",
    outcome,
    "Final tally:",
    `- ${poll.winner.observanceName}: ${voteLabel(poll.winner.voteCount)}`,
    `- ${poll.alternate.observanceName}: ${voteLabel(poll.alternate.voteCount)}`,
    "Tonight's display is scheduled for 6:00 PM Pacific.",
  ].join("\n");
}

function validateEvent(event) {
  if (
    typeof event !== "object" ||
    event === null ||
    typeof event.eventId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      event.eventId,
    ) ||
    typeof event.date !== "string" ||
    typeof event.observanceName !== "string" ||
    !Number.isFinite(event.candidateVoteCount) ||
    !Number.isFinite(event.totalVoteCount)
  ) {
    throw new Error("Pink Door site returned a malformed notification event.");
  }
  return event;
}

function validatePollCandidate(candidate) {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    typeof candidate.observanceName !== "string" ||
    candidate.observanceName.length < 1 ||
    !Number.isInteger(candidate.voteCount) ||
    candidate.voteCount < 0
  ) {
    throw new Error("Pink Door site returned a malformed poll candidate.");
  }
  return {
    observanceName: candidate.observanceName,
    voteCount: candidate.voteCount,
  };
}

function validatePollResult(result) {
  if (
    typeof result !== "object" ||
    result === null ||
    typeof result.date !== "string" ||
    typeof result.opensAt !== "string" ||
    typeof result.closesAt !== "string" ||
    !Number.isFinite(Date.parse(result.opensAt)) ||
    !Number.isFinite(Date.parse(result.closesAt)) ||
    !Number.isInteger(result.totalVoteCount) ||
    result.totalVoteCount < 0
  ) {
    throw new Error("Pink Door site returned a malformed poll result.");
  }
  const winner = validatePollCandidate(result.winner);
  const alternate = validatePollCandidate(result.alternate);
  if (winner.voteCount + alternate.voteCount !== result.totalVoteCount) {
    throw new Error("Pink Door poll totals do not match candidate totals.");
  }
  return {
    date: result.date,
    opensAt: result.opensAt,
    closesAt: result.closesAt,
    winner,
    alternate,
    totalVoteCount: result.totalVoteCount,
  };
}

function readEnvFile(path) {
  const values = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function resolveDiscordToken() {
  const values = readEnvFile(join(DISCORD_STATE_DIR, ".env"));
  const direct = process.env.DISCORD_BOT_TOKEN ?? values.DISCORD_BOT_TOKEN;
  if (direct?.trim()) return direct.trim();

  const reference =
    process.env.DISCORD_BOT_TOKEN_REF ?? values.DISCORD_BOT_TOKEN_REF;
  if (!reference?.trim()) {
    throw new Error("Discord for Codex credential is unavailable.");
  }
  const opPath = existsSync("/opt/homebrew/bin/op")
    ? "/opt/homebrew/bin/op"
    : "op";
  return execFileSync(opPath, ["read", reference.trim()], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function resolvePublisherToken() {
  return execFileSync(
    "/usr/bin/security",
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

function siteBaseUrl() {
  const configured = process.env.PINK_DOOR_SITE_URL;
  if (configured?.startsWith("https://")) return configured.replace(/\/$/, "");
  const parsed = JSON.parse(readFileSync(PUBLISHER_CONFIG, "utf8"));
  if (
    typeof parsed.baseUrl !== "string" ||
    !parsed.baseUrl.startsWith("https://")
  ) {
    throw new Error("The public site URL is not configured.");
  }
  return parsed.baseUrl.replace(/\/$/, "");
}

function soleAllowedSender() {
  const access = JSON.parse(
    readFileSync(join(DISCORD_STATE_DIR, "access.json"), "utf8"),
  );
  if (access.dmPolicy !== "allowlist") {
    throw new Error("Discord DM policy must be allowlist.");
  }
  if (!Array.isArray(access.allowFrom) || access.allowFrom.length !== 1) {
    throw new Error("Discord must have exactly one allowed sender.");
  }
  return String(access.allowFrom[0]);
}

async function fetchJson(url, init, label, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        throw new Error(`${label} returned HTTP ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolvePromise) =>
          setTimeout(resolvePromise, 1_500),
        );
      }
    }
  }
  throw lastError;
}

async function fetchOptionalJson(url, init, label, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(`${label} returned HTTP ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolvePromise) =>
          setTimeout(resolvePromise, 1_500),
        );
      }
    }
  }
  throw lastError;
}

async function publisherRequest(context, path, init = {}) {
  return fetchJson(
    `${context.baseUrl}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${context.publisherToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    },
    "Pink Door site",
  );
}

async function discordRequest(context, path, init = {}) {
  return fetchJson(
    `${DISCORD_API}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bot ${context.discordToken}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    },
    "Discord",
  );
}

async function resolveDiscordDm(context) {
  const recipientId = soleAllowedSender();
  const channel = await discordRequest(context, "/users/@me/channels", {
    method: "POST",
    body: JSON.stringify({ recipient_id: recipientId }),
  });
  if (typeof channel.id !== "string") {
    throw new Error("Discord did not return a DM channel.");
  }
  return channel.id;
}

async function sendDiscordMessage(context, text) {
  const channelId = await resolveDiscordDm(context);
  await discordRequest(context, `/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: text,
      allowed_mentions: { parse: [] },
    }),
  });
}

async function pendingEvents(context, date) {
  const payload = await publisherRequest(
    context,
    `/api/admin/polls/${date}/notifications`,
  );
  if (!Array.isArray(payload.events)) {
    throw new Error("Pink Door site returned malformed notification data.");
  }
  return payload.events.map(validateEvent);
}

async function pollResult(context, date) {
  const payload = await fetchOptionalJson(
    `${context.baseUrl}/api/admin/polls/${date}/result`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${context.publisherToken}` },
    },
    "Pink Door site",
  );
  return payload === null ? null : validatePollResult(payload);
}

async function acknowledgeEvent(context, date, eventId) {
  await publisherRequest(
    context,
    `/api/admin/polls/${date}/notifications`,
    {
      method: "POST",
      body: JSON.stringify({ eventId }),
    },
  );
}

async function buildContext() {
  return {
    baseUrl: siteBaseUrl(),
    publisherToken: resolvePublisherToken(),
    discordToken: resolveDiscordToken(),
  };
}

async function checkConfiguration(context) {
  soleAllowedSender();
  await discordRequest(context, "/users/@me");
  const events = await pendingEvents(context, pacificDate());
  process.stdout.write(
    `${JSON.stringify({ ready: true, pendingCount: events.length })}\n`,
  );
}

async function runCycle(context) {
  const date = pacificDate();
  const poll = await pollResult(context, date);
  const events = await pendingEvents(context, date);
  const state = loadState();
  let delivered = 0;
  let acknowledged = 0;
  let lifecycleDelivered = 0;

  if (
    poll &&
    pollPhase(new Date(), poll) === "open" &&
    state.pollOpenedDate !== date
  ) {
    await sendDiscordMessage(
      context,
      formatPollOpenedMessage(poll, context.baseUrl),
    );
    state.pollOpenedDate = date;
    state.lastSuccessfulDelivery = new Date().toISOString();
    saveState(state);
    lifecycleDelivered += 1;
  }

  for (const event of events) {
    const alreadySent = state.sentUnacknowledged.includes(event.eventId);
    if (!alreadySent) {
      await sendDiscordMessage(context, formatDiscordMessage(event));
      state.sentUnacknowledged.push(event.eventId);
      saveState(state);
      delivered += 1;
    }

    await acknowledgeEvent(context, date, event.eventId);
    state.sentUnacknowledged = state.sentUnacknowledged.filter(
      (eventId) => eventId !== event.eventId,
    );
    state.lastSuccessfulDelivery = new Date().toISOString();
    saveState(state);
    acknowledged += 1;
  }

  if (
    poll &&
    pollPhase(new Date(), poll) === "closed" &&
    state.pollClosedDate !== date
  ) {
    await sendDiscordMessage(context, formatPollClosedMessage(poll));
    state.pollClosedDate = date;
    state.lastSuccessfulDelivery = new Date().toISOString();
    saveState(state);
    lifecycleDelivered += 1;
  }

  writeHealth({
    status: "ready",
    pendingCount: events.length,
    deliveredCount: delivered,
    acknowledgedCount: acknowledged,
    lifecycleDeliveredCount: lifecycleDelivered,
    lastSuccessfulPoll: new Date().toISOString(),
  });
}

async function main() {
  ensureStateDirectory();
  const context = await buildContext();
  if (process.argv.includes("--check")) {
    await checkConfiguration(context);
    return;
  }

  let stopped = false;
  let running = false;
  const stop = () => {
    stopped = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopped) {
    if (!running) {
      running = true;
      try {
        await runCycle(context);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown daemon failure.";
        writeHealth({ status: "error", error: message });
        process.stderr.write(
          `pink-door-vote-notifications: ${message}\n`,
        );
      } finally {
        running = false;
      }
    }
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, POLL_INTERVAL_MS),
    );
  }
}

const mainPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (mainPath === import.meta.url) {
  main().catch((error) => {
    const message =
      error instanceof Error ? error.message : "Unknown daemon failure.";
    process.stderr.write(`pink-door-vote-notifications: ${message}\n`);
    process.exitCode = 1;
  });
}
