# Daily Festavia observance theme

At each run, use the current calendar date in America/Los_Angeles.

1. Read this automation's memory first. From this project directory, retrieve the ranked poll result with:

`node scripts/pink-door-publisher.mjs result <YYYY-MM-DD>`

The helper reads the publisher credential from macOS Keychain and retries once. Never print or log the credential. The result ranks candidates by vote count, then preference rank for ties and no-vote polls. Keep the returned winner, alternate, vote counts, synopsis, source, palette, mode, effect, lighting description, and static fallback available for later publication and Discord reporting.

2. Target only the Philips Hue light named exactly "Festavia permanent 1" (currently in Porch). Use the local OpenHue CLI and, when necessary for Festavia gradients and effects, the local Hue v2 API credentials already configured by OpenHue. Never print, log, or send bridge credentials, application keys, Hue resource identifiers, or private diagnostics. Confirm the exact light exists before changing state. Read its current Hue v2 `gradient`, `effects_v2`, `effects`, `timed_effects`, and `dynamics` capabilities.

3. Revalidate the ranked winner against the fresh capabilities and all safety rules below. If it is no longer eligible, use the alternate and record a concise substitution reason. If neither candidate qualifies, the poll is unavailable, or result retrieval fails, use the stable static Arctic Aurora catalog fallback and state why.

For all treatments, apply 75% brightness, keep the light ON, and use a gentle transition of at most 3 seconds if supported.

Static gradient: Use the candidate's 3-5 sRGB hex colors. Convert them to gamut-clipped CIE xy values for the Festavia gamut and apply all points in one Hue v2 gradient/state update. Set `effects_v2.action.effect` to `no_effect` when supported, otherwise use legacy `effects.effect: no_effect`.

Hue effect: Use the built-in effect only if it remains in the light's current reported effect values and is appropriate for gentle ambient lighting. Prefer the non-deprecated `effects_v2.action` interface. Set at most one supported effect color input under `effects_v2.action.parameters`, using either one `color.xy` tint derived from the candidate's single hex color or one `color_temperature.mirek`, never both. Do not write gradient points and claim they are animated effect colors. If the bridge rejects parameters or the effect uses Hue-native fixed colors, enable it without parameters and describe the palette as `Hue-native <effect> colors`; never invent hex values. If the effect itself is rejected or unsafe, apply that candidate's `fallbackPalette` as a Static gradient with `no_effect` and record the downgrade.

Stable fallback: Inspect the Porch scene "Arctic aurora" before using it. Confirm its actions target only "Festavia permanent 1". If it includes any other light, reproduce its static palette on Festavia through one Hue v2 gradient update so no unrelated light changes. Keep it static and disable all effects.

For every path, avoid timed effects, dynamic palettes, alerts, signaling, external animation loops, repeated whole-light changes, rapid changes, flashing, and strobing. Do not approximate a gradient or effect by repeatedly changing the whole light.

4. Read the Festavia light state again. Verify it is ON and report actual brightness. For Static gradient or fallback, verify `effects_v2.status.effect` or legacy effect status is `no_effect`, timed effects are `no_effect`, dynamics status is `none`, and the expected gradient point count and mode are present. For Hue effect, verify `effects_v2.status.effect` equals the requested effect, using legacy status only if v2 was unavailable; also verify timed effects are `no_effect` and dynamics status is `none`. Treat an API error, mismatched effect, OFF state, or unverified state as Hue failure. Never turn the light off at the end.

5. Publish the treatment actually verified, or an unavailable state if Hue verification failed. Build a public-safe temporary JSON payload for `PUT /api/admin/themes/:date` containing only the observance name, synopsis, HTTPS source, public palette, verified mode, verified effect, lighting description, public status, selected candidate ID or null, selected vote count, total vote count, and substitution note or null. Never include brightness, an address, Hue identifiers, credentials, Discord data, or diagnostics. For a Hue-native fixed-color effect, publish an empty palette. For a fallback, publish the actual static colors. Run:

`node scripts/pink-door-publisher.mjs theme <YYYY-MM-DD> <payload-path>`

The helper retries once. Delete the temporary payload afterward. Keep site publication failure separate from Hue application and verification status.

6. Use the Discord for Codex plugin. Confirm `connection_status` reports the bot ready, the DM policy is `allowlist`, and exactly one sender is allowed. Resolve the sole approved DM chat from the local approved marker without printing or storing Discord IDs. Send exactly one concise DM with the `reply` tool. Include exactly these labeled facts in a compact plain-text format: Observance, Palette, Mode, Effect, Brightness, and Result.

For Static gradient and Static catalog fallback, report palette entries as `Color name #RRGGBB ` with whitespace after each hex token and no punctuation directly after it. For Hue effect with a custom tint, report only `Effect tint name #RRGGBB `. For a color-temperature effect, report `Effect temperature <kelvin>K` without a fabricated hex. For a Hue-native fixed-color effect, report `Hue-native <effect> colors`. Mode must be exactly `Static gradient`, `Hue effect`, or `Static catalog fallback`. Effect must be the verified effect status or `no_effect`. Result must state Hue application and ON-state/mode verification success or a short failure reason, plus a short site publication failure only when publishing failed. Disclose winner substitution or fallback briefly. Do not use broad mentions.

7. Record the ranked result, chosen candidate, any substitution or fallback, source URL, verified physical state summary, public publication result, and Discord delivery result in automation memory. Do not store Discord IDs and do not send more than one Discord DM per run. Do not send Slack messages.
