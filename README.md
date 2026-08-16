# The House with the Pink Door

A public, mobile-first daily light theme and neighborhood voting site. It is
deployed with OpenAI Sites and stores polls, anonymous votes, and applied themes
in D1.

## Daily flow

- 8:00 AM America/Los_Angeles: publish two verified candidates.
- 5:50 PM: voting closes.
- 6:00 PM: the existing Festavia automation applies the eligible winner,
  verifies the physical light, publishes the applied theme, and sends one
  Discord DM through the Discord for Codex plugin.
- The Sites Worker delivers poll-open, first-vote, and poll-close notifications
  from the requests that create them. D1 keeps failed deliveries for a later
  request or an explicit retry. Vote changes do not create another alert.

The public app has no route to the Hue bridge. Protected publishing routes use a
bearer token stored in Sites runtime secrets and macOS Keychain.

## Local development

```bash
npm run dev
npm run test:unit
npm run build
```

The development server supplies project-local placeholder secrets. Production
secrets are managed through Sites.

## Publisher helper

The automation uses `scripts/pink-door-publisher.mjs`:

```bash
node scripts/pink-door-publisher.mjs poll 2026-07-24 poll.json
node scripts/pink-door-publisher.mjs result 2026-07-24
node scripts/pink-door-publisher.mjs theme 2026-07-24 theme.json
node scripts/pink-door-publisher.mjs notifications 2026-07-24
node scripts/pink-door-publisher.mjs retry-notifications 2026-07-24
```

The helper reads the public base URL from `publisher.config.json` and the bearer
token from the `festavia-theme-site-publisher` macOS Keychain item.

The reviewable automation source prompts are in `automations/`. The poll
publisher canonicalizes each date's opening and closing timestamps to 8:00 AM
and 5:50 PM America/Los_Angeles.

## Festavia Hue helper

Codex lighting work in this project invokes the user-level
`$control-hue-lights` skill, which recognizes the Festavia workflow and
delegates to this repository's adapter. The repo-local adapter remains the
source of truth for candidate validation, the fixed target, effect persistence,
and static fallback behavior. Automated runs must not use the skill's generic
light and scene writer to bypass those rules.

The local Hue v2 helper avoids the OpenHue CLI connection path that macOS Local
Network Privacy blocks inside Codex. It reads the existing OpenHue
configuration, passes the application key to system `curl` through stdin, and
never emits bridge credentials or Hue resource identifiers.

```bash
node scripts/festavia-hue.mjs inspect
node scripts/festavia-hue.mjs apply candidate.json
node --test tests/festavia-hue.test.mjs
node scripts/sync-pink-door-automation-prompts.mjs
```

`apply` accepts one public-safe candidate object from the ranked poll result. It
targets only `Festavia permanent 1`, applies 75% brightness, and verifies the
physical state. Effects must remain active across two delayed readbacks. If an
effect briefly activates and resets, the helper applies and verifies that
candidate's static fallback palette before reporting success.

After reviewing prompt changes under `automations/`, run the sync command to
copy those sources into the two live Codex automation configurations.

## Discord notifications

The existing Sites Worker sends notifications through the Discord bot to its
sole approved recipient. The bot token remains a Sites secret, and Discord
identifiers are never returned by a public route. A D1 outbox provides bounded
retry and deduplication without a local process or scheduled poller. The open
message lists both choices and links to the public poll. The close message
reports the deterministic ranked result and final tally before the separate
6:00 PM light application.

Production: <https://pink.awzone.com>

Printable assets:

- `public/pink-door-qr.png`
- `public/pink-door-qr.svg`
- `public/the-house-with-the-pink-door-sign.pdf`
