#!/usr/bin/env node

import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import process from "node:process";
import {
  createCurlRequester,
  createFestaviaController,
  parseOpenHueConfig,
} from "./festavia-hue-lib.mjs";

function usage() {
  console.error(
    "Usage: festavia-hue.mjs <inspect|apply> [candidate.json]",
  );
  process.exit(2);
}

async function main() {
  const [operation, candidatePath] = process.argv.slice(2);
  if (
    !["inspect", "apply"].includes(operation) ||
    (operation === "apply" && !candidatePath) ||
    (operation === "inspect" && candidatePath)
  ) {
    usage();
  }

  const configContents = await readFile(
    join(homedir(), ".openhue", "config.yaml"),
    "utf8",
  );
  const config = parseOpenHueConfig(configContents);
  const request = createCurlRequester(config);
  const controller = createFestaviaController({ request });

  const result =
    operation === "inspect"
      ? await controller.inspect()
      : await controller.apply(
          JSON.parse(await readFile(candidatePath, "utf8")),
        );
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Festavia operation failed.";
  console.error(message);
  process.exit(1);
});
