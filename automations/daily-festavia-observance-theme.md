# Daily Festavia observance theme

At each run, use the current calendar date in America/Los_Angeles.

Use `$control-hue-lights` and follow its Festavia theme project adapter. The repository's `scripts/festavia-hue.mjs` helper is authoritative for this workflow; do not replace it with the skill's generic Hue helper or direct OpenHue writes.

1. Read this automation's memory first. From this project directory, retrieve the ranked poll result with:

`node scripts/pink-door-publisher.mjs result <YYYY-MM-DD>`

The helper reads the publisher credential from macOS Keychain and retries once. Never print or log the credential. The result ranks candidates by vote count, then preference rank for ties and no-vote polls. Keep the returned winner, alternate, vote counts, synopsis, source, palette, mode, effect, lighting description, and fallback palette available for later publication and Discord reporting.

2. Target only the Philips Hue light named exactly "Festavia permanent 1" (currently in Porch). Do not use `openhue get` or `openhue set` from the Codex command runner; macOS Local Network Privacy blocks that executable even though it works in Terminal. From this project directory, inspect the exact light and its sanitized Hue v2 capabilities with:

`node scripts/festavia-hue.mjs inspect`

The helper reads the existing OpenHue bridge configuration, passes the application key to system `curl` through stdin so it never appears in process arguments, resolves the exact light uniquely, and emits no bridge address, application key, or Hue resource identifiers. Treat a nonzero exit, a target count other than one, or missing capabilities as failure.

3. Revalidate the ranked winner against the fresh capabilities and all safety rules below. If it is no longer eligible, use the alternate and record a concise substitution reason. If neither candidate qualifies, the poll is unavailable, or result retrieval fails, use the Arctic Aurora catalog palette through the safe fallback path and state why.

For all treatments, apply 75% brightness, keep the light ON, and use a gentle transition of at most 3 seconds if supported.

Static gradient: Use the candidate's 3-5 sRGB hex colors. Convert them to gamut-clipped CIE xy values for the Festavia gamut and apply all points in one Hue v2 gradient/state update. Set `effects_v2.action.effect` to `no_effect` when supported, otherwise use legacy `effects.effect: no_effect`.

Dynamic palette: Use the candidate's 3-5 sRGB colors only when the fresh helper inspection reports `dynamicPalette.supported: true`. The helper owns the implementation: it validates or creates one reserved zone containing only the exact Festavia light, updates one reserved scene with the candidate palette and fixed calm speed, recalls `dynamic_palette`, and verifies both the light and scene twice. Do not create, update, or recall a Hue scene outside the helper.

Hue effect: Use the built-in effect only if it remains in the light's current reported `effectValues` and is appropriate for gentle ambient lighting. A candidate may contain exactly one tint only when its effect is in the helper's fresh `effectColorValues`; otherwise its palette must be empty. `effectStatusParameters` describes the currently active effect and is not a capability map for other effects. If a tinted candidate is not in `effectColorValues`, treat it as ineligible and use the alternate. Never invent hex values for Hue-native effect colors.

Stable fallback: Inspect the Porch scene "Arctic aurora" before using it. Confirm its actions target only "Festavia permanent 1" and extract its public-safe palette. Prefer applying those colors as a Dynamic palette through the authoritative helper when `dynamicPalette.supported` is true. If dynamic application is unavailable or cannot be verified, reproduce the palette as one static Festavia gradient update. Never recall a scene that includes another light.

For every path, the only permitted animated gradient is the helper-managed `Dynamic palette` scene. Avoid timed effects, direct scene writes, alerts, signaling, external animation loops, repeated whole-light changes, rapid changes, flashing, and strobing. Do not approximate a gradient or effect by repeatedly changing the whole light.

4. Write only the selected candidate object from the ranked result to a temporary JSON file. Apply and verify it with:

`node scripts/festavia-hue.mjs apply <candidate-path>`

The helper applies only to the uniquely resolved Festavia and verifies ON state, actual brightness, disabled timed effects, and the requested mode. For a verified tint-capable effect, it converts the candidate's one sRGB tint to a gamut-clipped CIE xy input under `effects_v2.action.parameters.color` and verifies the returned color under `effects_v2.status.parameters.color` without claiming that the tint replaces every native effect color. Hue effects and Dynamic palette treatments must match on two readbacks 30 seconds apart so a treatment that briefly reports active and then resets is not accepted. Effect requests omit gradient, timed-effect, and dynamics fields after preflight confirms no timed or dynamic treatment is active. If a supported effect is rejected or does not remain active, the helper first applies the candidate's `fallbackPalette` as Dynamic palette; it uses a static gradient only if that dynamic fallback is unavailable or unverifiable. Static treatments must read back `no_effect`, inactive dynamics, `interpolated_palette`, and the expected gradient point count. Dynamic treatments must read back `no_effect`, `dynamic_palette`, and an active reserved scene. Treat a nonzero exit or `ok` other than `true` as Hue failure. Never turn the light off at the end. Delete the temporary candidate file after the command completes.

5. Publish the treatment reported by the helper as verified, or an unavailable state if Hue verification failed. Build a public-safe temporary JSON payload for `PUT /api/admin/themes/:date` containing only the observance name, synopsis, HTTPS source, helper-reported palette, verified mode, verified effect, lighting description, public status, selected candidate ID or null, selected vote count, total vote count, and helper-reported substitution note or null. Never include brightness, helper state details, an address, Hue identifiers, credentials, Discord data, or diagnostics. For a verified custom-tint effect, publish the one tint returned by the helper. For a Hue-native fixed-color effect, publish an empty palette. For a fallback, publish the actual palette and mode returned by the helper. Run:

Keep every public synopsis in natural audience-facing language. Preserve the candidate's plain-language observance explanation and describe the applied lighting only as a visitor would see it: color when known, glow, twinkle, flow, shimmer, or gentle movement. Never add Hue, API, parameter, input, verification, capability, bridge, identifier, status, or fallback jargon to public text.

`node scripts/pink-door-publisher.mjs theme <YYYY-MM-DD> <payload-path>`

The helper retries once. Delete the temporary payload afterward. Keep site publication failure separate from Hue application and verification status.

6. Use the Discord for Codex plugin. Confirm `connection_status` reports the bot ready, the DM policy is `allowlist`, and exactly one sender is allowed. Resolve the sole approved DM chat from the local approved marker without printing or storing Discord IDs. Send exactly one concise DM with the `reply` tool. Include exactly these labeled facts in a compact plain-text format: Observance, Palette, Mode, Effect, Brightness, and Result.

For Static gradient, Dynamic palette, and Static catalog fallback, report palette entries as `Color name #RRGGBB ` with whitespace after each hex token and no punctuation directly after it. For Hue effect with a custom tint, report only `Effect tint name #RRGGBB `. For a color-temperature effect, report `Effect temperature <kelvin>K` without a fabricated hex. For a Hue-native fixed-color effect, report `Hue-native <effect> colors`. Mode must be exactly `Static gradient`, `Dynamic palette`, `Hue effect`, or `Static catalog fallback`. Effect must be the verified effect status or `no_effect`. Result must state Hue application and ON-state/mode verification success or a short failure reason, plus a short site publication failure only when publishing failed. Disclose winner substitution or fallback briefly. Do not use broad mentions.

7. After the public theme publication succeeds with `publicStatus: "active"`, generate exactly one polished 1200x630 chosen-theme social card with the image generation tool. Use the established House with the Pink Door poster language: rich near-black background, dimensional hot-pink door, tasteful decorative bulbs, expressive cream editorial serif typography, and realistic editorial objects that evoke the verified applied observance and treatment. Include the exact applied observance name, `TONIGHT'S PINK DOOR THEME`, and the verified public treatment name. Do not include an address, Hue or device information, brightness, credentials, Discord or Slack information, diagnostics, vote internals, people, logos, or watermarks. Inspect the result for exact text and treatment accuracy; retry once only if unusable. Save the accepted PNG temporarily, publish it with `node scripts/pink-door-publisher.mjs social-theme <YYYY-MM-DD> <image-path>`, and delete the temporary image. If the public theme is unavailable, or generation/upload fails, do not invent a result; leave the site's public-safe pending/unavailable fallback intact.

8. Record the ranked result, chosen candidate, any substitution or fallback, source URL, verified physical state summary, public publication result, social-preview publication result, and Discord delivery result in automation memory. Do not store Discord IDs and do not send more than one Discord DM per run. Do not send Slack messages.
