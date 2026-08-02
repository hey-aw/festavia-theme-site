#!/usr/bin/env node

import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, rename, stat, writeFile } from "node:fs/promises";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const automationRoot = join(homedir(), ".codex", "automations");
const prompts = [
  {
    id: "daily-pink-door-theme-candidates",
    source: "automations/daily-pink-door-theme-candidates.md",
  },
  {
    id: "daily-festavia-observance-theme",
    source: "automations/daily-festavia-observance-theme.md",
  },
];

function replacePrompt(toml, prompt) {
  const lines = toml.split("\n");
  const matches = lines
    .map((line, index) => (/^prompt\s*=/.test(line) ? index : -1))
    .filter((index) => index >= 0);
  if (matches.length !== 1) {
    throw new Error("Automation config must contain exactly one prompt field.");
  }
  lines[matches[0]] = `prompt = ${JSON.stringify(prompt.trimEnd())}`;
  return lines.join("\n");
}

for (const automation of prompts) {
  const sourcePath = join(projectRoot, automation.source);
  const configPath = join(automationRoot, automation.id, "automation.toml");
  const temporaryPath = `${configPath}.tmp`;
  const [prompt, config, configStat] = await Promise.all([
    readFile(sourcePath, "utf8"),
    readFile(configPath, "utf8"),
    stat(configPath),
  ]);
  const updated = replacePrompt(config, prompt);
  await writeFile(temporaryPath, updated, { mode: configStat.mode });
  await rename(temporaryPath, configPath);
  process.stdout.write(`Updated ${automation.id}\n`);
}
