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
- A local macOS daemon checks the public-safe notification outbox every 30
  seconds and delivers first-vote notifications to the same approved Discord
  DM. Vote changes do not create another alert.

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
node scripts/pink-door-publisher.mjs ack-notification 2026-07-24 event.json
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

## Discord notification daemon

The daemon reuses the Discord for Codex bot credential and sole allowlisted
recipient. Discord identifiers and credentials stay in memory; its crash
recovery file stores only notification event IDs.

```bash
npm run daemon:vote-notifications:check
npm run daemon:vote-notifications:install
```

The installer manages the
`com.hey-aw.pink-door-discord-vote-notifications` user LaunchAgent. Runtime
health and owner-only logs are stored under
`~/.codex/daemons/pink-door-discord-vote-notifications/`.

Production: <https://house-with-pink-door.hey-aw.chatgpt.site>

Printable assets:

- `public/pink-door-qr.png`
- `public/pink-door-qr.svg`
- `public/the-house-with-the-pink-door-sign.pdf`
