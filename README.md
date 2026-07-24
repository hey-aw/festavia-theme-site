# The House with the Pink Door

A public, mobile-first daily light theme and neighborhood voting site. It is
deployed with OpenAI Sites and stores polls, anonymous votes, and applied themes
in D1.

## Daily flow

- 8:00 AM America/Los_Angeles: publish two verified candidates.
- 5:50 PM: voting closes.
- 6:00 PM: the existing Festavia automation applies the eligible winner,
  verifies the physical light, publishes the applied theme, and sends one Slack
  DM.

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
```

The helper reads the public base URL from `publisher.config.json` and the bearer
token from the `festavia-theme-site-publisher` macOS Keychain item.
