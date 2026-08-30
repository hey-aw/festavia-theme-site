# Daily Festavia observance theme

Each run, use the current local date in America/Los_Angeles and read this automation's memory first.

Target only the Philips Hue light named exactly `Festavia permanent 1`, currently in Porch. Use `$control-hue-lights` and follow its Festavia theme project adapter. The repository helper `scripts/festavia-hue.mjs` is authoritative. Do not use direct OpenHue writes from the Codex command runner and do not replace the adapter with the skill's generic Hue helper. Never print, log, store, or transmit bridge credentials, application keys, Hue resource identifiers, or private diagnostics.

1. Run `node scripts/festavia-hue.mjs inspect`. Require a successful sanitized response, exactly one target, and the required capabilities. Do not change any state during inspection.

2. Read today's poll and winner with `node scripts/pink-door-publisher.mjs winner <YYYY-MM-DD>`. The helper reads its credential from macOS Keychain. Treat a rejected or unverified response as failure. Do not print the credential.

3. Before writing any temporary file or changing Hue state, stop if automation memory already records a successful apply for today's date and the same winning candidate ID. Record a concise duplicate-run note in memory only; do not apply Hue, publish, generate media, or send any message.

4. Apply exactly the winning candidate with `node scripts/festavia-hue.mjs apply <candidate-json-path>`. The candidate JSON must be the exact winning candidate from the verified winner response, with no edits or substitutions. The adapter may use the candidate's safe fallback palette according to its verified capability and persistence checks. Do not issue any other Hue command.

5. Verify the sanitized apply result reports success, the expected candidate ID and observance name, and a stable state. If the adapter reports a fallback, record the public-safe fallback mode and reason. Do not expose Hue identifiers or diagnostics.

6. Delete temporary candidate files. Do not send Messages, Discord, or Slack messages.

7. Record the date, winning observance, candidate ID, requested mode/effect, applied mode/effect, whether fallback was used, and a sanitized capability/result summary in automation memory. Never store credentials, Hue resource identifiers, or private diagnostics.
