import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// This workflow is an agent prompt, so its control-flow contract lives in prose.
const prompt = readFileSync(
  new URL("../automations/daily-festavia-observance-theme.md", import.meta.url),
  "utf8",
);
const guard = prompt.slice(prompt.indexOf("3. "), prompt.indexOf("4. "));
const verification = prompt.slice(prompt.indexOf("6. "), prompt.indexOf("7. "));

test("publication verification bypasses cache and bounds retries beyond its TTL", () => {
  assert.match(verification, /api\/themes\?limit=7&verify=<fresh-unique-nonce>/);
  assert.match(verification, /new nonce on every attempt/);
  assert.match(verification, /Cache-Control: no-cache/);
  assert.match(verification, /90-second total deadline/);
  assert.match(verification, /timeout of at most 10 seconds capped by the remaining deadline/);
  assert.match(verification, /5-second waits/);
  assert.match(verification, /Retry transient HTTP\/network failures.*missing or mismatched records/);
  assert.match(verification, /same date and candidate ID.*publicStatus: "active"/);
  assert.match(verification, /observance, palette, mode, effect, vote counts, and source match/);
  assert.match(verification, /never reapply Hue as a verification retry/);
});

test("pre-apply guard uses public success even after memory persistence fails", () => {
  assert.match(guard, /before creating temporary files or changing Hue state/);
  assert.match(guard, /automation memory and the live public theme record/);
  assert.match(guard, /cache-bypassing request and bounded retry policy in step 6/);
  assert.match(guard, /same date and `selectedCandidateId` with `publicStatus: "active"`/);
  assert.match(guard, /stop without applying Hue or republishing, even when memory is missing or its last write failed/);
  assert.match(guard, /different date\/candidate is not a success marker/);
  assert.match(guard, /lookup fails after retries, stop/);
  assert.match(guard, /successful stable apply but public publication is missing or failed, do not apply Hue again/);
  assert.match(guard, /details are incomplete, stop/);
});

test("capability drift stays inside the exact-winner adapter fallback", () => {
  const apply = prompt.slice(prompt.indexOf("4. "), prompt.indexOf("5. Publish"));
  assert.match(apply, /exact `winner` object.*without edits or substitutions/);
  assert.match(apply, /skip the unsupported effect write/);
  assert.match(apply, /unchanged candidate's `fallbackPalette`/);
  assert.match(apply, /verified Dynamic palette path, then its verified static gradient path/);
  assert.match(apply, /two readbacks 30 seconds apart/);
  assert.match(apply, /remain safety failures/);
});
