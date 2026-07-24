#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const LABEL = "com.hey-aw.pink-door-discord-vote-notifications";
const PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DAEMON_SCRIPT = join(
  PROJECT_DIR,
  "scripts",
  "pink-door-vote-notification-daemon.mjs",
);
const STATE_DIR = join(
  homedir(),
  ".codex",
  "daemons",
  "pink-door-discord-vote-notifications",
);
const LAUNCH_AGENTS_DIR = join(homedir(), "Library", "LaunchAgents");
const PLIST_PATH = join(LAUNCH_AGENTS_DIR, `${LABEL}.plist`);
const DOMAIN = `gui/${process.getuid()}`;
const SERVICE = `${DOMAIN}/${LABEL}`;

function xml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function plist() {
  const path = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    dirname(process.execPath),
    "/usr/bin",
    "/bin",
  ].join(":");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(process.execPath)}</string>
    <string>${xml(DAEMON_SCRIPT)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xml(PROJECT_DIR)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${xml(homedir())}</string>
    <key>PATH</key>
    <string>${xml(path)}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>Umask</key>
  <integer>63</integer>
  <key>StandardOutPath</key>
  <string>${xml(join(STATE_DIR, "daemon.log"))}</string>
  <key>StandardErrorPath</key>
  <string>${xml(join(STATE_DIR, "daemon.err.log"))}</string>
</dict>
</plist>
`;
}

function bootout() {
  try {
    execFileSync("/bin/launchctl", ["bootout", SERVICE], {
      stdio: "ignore",
    });
  } catch {
    // The service is not currently loaded.
  }
}

function uninstall() {
  bootout();
  rmSync(PLIST_PATH, { force: true });
  process.stdout.write(`${JSON.stringify({ installed: false, label: LABEL })}\n`);
}

function install() {
  mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  chmodSync(STATE_DIR, 0o700);
  mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
  const temporary = `${PLIST_PATH}.tmp`;
  writeFileSync(temporary, plist(), { mode: 0o600 });
  renameSync(temporary, PLIST_PATH);
  chmodSync(PLIST_PATH, 0o600);

  bootout();
  execFileSync("/bin/launchctl", ["bootstrap", DOMAIN, PLIST_PATH], {
    stdio: "ignore",
  });
  execFileSync("/bin/launchctl", ["kickstart", "-k", SERVICE], {
    stdio: "ignore",
  });
  process.stdout.write(`${JSON.stringify({ installed: true, label: LABEL })}\n`);
}

if (process.argv.includes("--uninstall")) {
  uninstall();
} else {
  install();
}
