# Daily Festavia observance theme

Each run, use the current local date in America/Los_Angeles and read this automation's memory first.

Target only the Philips Hue light named exactly `Festavia permanent 1`, currently in Porch. Use `$control-hue-lights` and follow its Festavia theme project adapter. The repository helper `scripts/festavia-hue.mjs` is authoritative. Do not use direct OpenHue writes from the Codex command runner and do not replace the adapter with the skill's generic Hue helper. Never print, log, store, publish, or transmit bridge credentials, application keys, Hue resource identifiers, private diagnostics, or helper state details.

1. Run `node scripts/festavia-hue.mjs inspect`. Require a successful sanitized response, exactly one target, and the required capabilities. Do not change any state during inspection.

2. Read today's closed poll and winner with `node scripts/pink-door-publisher.mjs winner <YYYY-MM-DD>`. The helper reads its credential from macOS Keychain. Treat a rejected or unverified response as failure. Do not print the credential.

3. After winner verification and before creating temporary files or changing Hue state, check automation memory for the same date and winning candidate ID.

- If memory records both a successful stable apply and a verified public theme publication for that date and candidate, stop without side effects.
- If memory records a successful stable apply but public publication is missing or failed, do not apply Hue again. Resume at step 5 using the recorded public-safe applied mode, effect, palette, fallback status, and substitution note. If those public-safe applied details are incomplete, stop and report that publication recovery needs a verified applied result; do not guess or reapply.
- Otherwise continue with the exact winning candidate.

4. Write only the exact `winner` object from the verified winner response to a temporary JSON file, without edits or substitutions. Apply it once with `node scripts/festavia-hue.mjs apply <candidate-json-path>`. Do not issue any other Hue command. Require the sanitized result to report `ok: true`, the expected candidate ID and observance name, and a stable state. The adapter may use the candidate's safe fallback palette according to its verified capability and persistence checks. If it reports a fallback, retain the public-safe applied mode, effect, palette, and substitution reason. Delete the temporary candidate file after the command completes.

5. Publish the verified applied treatment to the site. Build a temporary public-safe JSON payload containing only:

- `observanceName` and `observanceSynopsis` from the verified winner
- the winner's HTTPS `sourceUrl`
- the applied `palette`, `mode`, and `effect` from the sanitized apply result, plus the winner's `lightingSynopsis` when the appearance did not change; if fallback changed the appearance, use a concise visitor-facing `lightingSynopsis` that accurately describes the verified result
- `publicStatus: "active"`
- the winning `selectedCandidateId`, its `selectedVoteCount`, and the poll's `totalVoteCount`
- the helper-reported public-safe `substitutionNote`, or `null`

For a Hue-native fixed-color effect, publish an empty palette. For a verified custom-tint effect or fallback, publish exactly the public-safe palette returned by the helper. Never include brightness, raw helper state, an address, Hue identifiers, credentials, messaging details, or diagnostics. Keep all public text natural and visitor-facing; do not mention Hue, APIs, verification, capabilities, identifiers, or fallback mechanics.

Run `node scripts/pink-door-publisher.mjs theme <YYYY-MM-DD> <payload-json-path>`. Treat a nonzero exit or `ok` other than `true` as a site publication failure separate from Hue status. Delete the temporary payload after the command completes.

6. Verify the live public response from `https://pink.awzone.com/api/themes?limit=7` includes the same date and candidate ID with `publicStatus: "active"`, and that its observance, palette, mode, effect, vote counts, and source match the published payload. Do not treat the publisher response alone as public verification.

7. Do not send Messages, Discord, or Slack messages. Record the date, winning observance, candidate ID, requested mode/effect, applied mode/effect/palette, whether fallback was used, a sanitized capability/result summary, site publication result, and live public verification result in automation memory. Never store credentials, Hue resource identifiers, private diagnostics, messaging identifiers, or raw helper state.
