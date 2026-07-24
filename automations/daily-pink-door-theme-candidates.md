# Daily Pink Door theme candidates

At each run, use the current calendar date in America/Los_Angeles.

1. Read this automation's memory first. Target only the Philips Hue light named exactly "Festavia permanent 1" (currently in Porch). Use the local OpenHue CLI and, only when necessary to inspect Festavia-specific capabilities, the local Hue v2 API credentials already configured by OpenHue. Never print, log, store in a payload, or send bridge credentials, application keys, Hue resource identifiers, or private diagnostics.

2. This is a read-only lighting run. Confirm the exact light exists, then read its current Hue v2 `gradient`, `effects_v2`, `effects`, `timed_effects`, and `dynamics` capabilities. Do not change the light's power, brightness, color, gradient, effect, timing, dynamics, alert, signaling, scene, or any other state.

3. Browse the web and verify observances for that exact local date with credible sources. Prefer official organizations, government agencies, museums, UN bodies, or established observance publishers; cross-check quirky observances when practical. Never use an unsourced social post or generated list as verification. Prefer two distinct verified observances. If only one credible observance is available, create two clearly different, safe treatments for that observance.

4. Create exactly two complete candidates that match the public API contract. Give them unique lowercase hyphenated IDs and unique preference ranks 1 and 2. Each candidate must include `id`, `preferenceRank`, `observanceName`, `observanceSynopsis`, `sourceUrl`, `palette`, `mode`, `effect`, `lightingSynopsis`, and `fallbackPalette`.

Static gradient candidates must use `mode: "Static gradient"`, `effect: "no_effect"`, and 3-5 clearly distinguishable sRGB colors in `palette`. Hue effect candidates may be used only when a gentle built-in effect clearly fits and the effect is currently reported by Festavia's `effects_v2.action.effect_values` or, only if v2 is unavailable, legacy `effects.effect_values`. Allowed effects are `candle`, `fire`, `prism`, `sparkle`, `opal`, `glisten`, `underwater`, `cosmos`, `sunbeam`, and `enchant`. For an effect with a supported custom tint, `palette` must contain exactly one tint color. For a Hue-native fixed-color effect, `palette` must be empty. Never fabricate effect colors. Do not offer a color-temperature effect candidate. Every candidate must include a tasteful 3-5 color static `fallbackPalette` that can be applied if its preferred effect becomes ineligible.

Keep both treatments calm and suitable for exterior ambient lighting. Never propose timed effects, dynamic palettes, alerts, signaling, external animation loops, repeated whole-light changes, rapid changes, flashing, or strobing.

5. Write a temporary JSON payload containing only `{ "candidates": [...] }`. From this project directory, publish it with:

`node scripts/pink-door-publisher.mjs poll <YYYY-MM-DD> <payload-path>`

The helper reads the publisher credential from macOS Keychain, adds the canonical 8:00 AM opening and 5:50 PM closing timestamps for America/Los_Angeles, and retries once. Do not print the credential. Delete the temporary payload after the command completes. Treat a rejected or unverified response as failure.

6. Do not send Slack messages and do not change any Hue state. Record the two observances, source URLs, candidate IDs, preference order, capability snapshot summary, and publication result in automation memory for traceability.
