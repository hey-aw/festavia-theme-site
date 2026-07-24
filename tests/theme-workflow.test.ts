import assert from "node:assert/strict";
import test from "node:test";
import {
  isIsoDate,
  pacificDate,
  phaseForPoll,
} from "../lib/pacific-time";
import {
  validateCandidate,
  validatePollPayload,
  validateThemePayload,
} from "../lib/validation";

const baseCandidate = {
  id: "world-snake-day",
  preferenceRank: 1,
  observanceName: "World Snake Day",
  observanceSynopsis:
    "A day to notice the diversity of snakes and the important roles they play in healthy ecosystems.",
  sourceUrl: "https://example.org/world-snake-day",
  palette: [
    { name: "Emerald", hex: "#0B6E4F" },
    { name: "Gold", hex: "#F6D32D" },
    { name: "Coral", hex: "#C92A2A" },
  ],
  mode: "Static gradient",
  effect: "no_effect",
  lightingSynopsis:
    "Jewel-like colors trace a calm path across the nightly display.",
  fallbackPalette: [
    { name: "Emerald", hex: "#0B6E4F" },
    { name: "Gold", hex: "#F6D32D" },
    { name: "Coral", hex: "#C92A2A" },
  ],
};

test("Pacific dates remain correct around daylight-saving changes", () => {
  assert.equal(pacificDate(new Date("2026-03-08T07:59:00Z")), "2026-03-07");
  assert.equal(pacificDate(new Date("2026-03-08T08:01:00Z")), "2026-03-08");
  assert.equal(pacificDate(new Date("2026-11-01T06:59:00Z")), "2026-10-31");
  assert.equal(pacificDate(new Date("2026-11-01T07:01:00Z")), "2026-11-01");
});

test("poll phases distinguish scheduled, open, preparing, and complete", () => {
  const opensAt = "2026-07-23T15:00:00.000Z";
  const closesAt = "2026-07-24T00:50:00.000Z";
  assert.equal(
    phaseForPoll(new Date("2026-07-23T14:59:00.000Z"), opensAt, closesAt, false),
    "scheduled",
  );
  assert.equal(
    phaseForPoll(new Date("2026-07-23T16:00:00.000Z"), opensAt, closesAt, false),
    "open",
  );
  assert.equal(
    phaseForPoll(new Date("2026-07-24T00:51:00.000Z"), opensAt, closesAt, false),
    "preparing",
  );
  assert.equal(
    phaseForPoll(new Date("2026-07-23T16:00:00.000Z"), opensAt, closesAt, true),
    "complete",
  );
});

test("poll validation requires exactly two ranked candidates", () => {
  const result = validatePollPayload(
    {
      opensAt: "2026-07-23T15:00:00.000Z",
      closesAt: "2026-07-24T00:50:00.000Z",
      candidates: [
        baseCandidate,
        {
          ...baseCandidate,
          id: "vanilla-ice-cream-day",
          preferenceRank: 2,
          observanceName: "Vanilla Ice Cream Day",
        },
      ],
    },
    "2026-07-23",
  );
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.preferenceRank),
    [1, 2],
  );
  assert.throws(
    () =>
      validatePollPayload(
        {
          opensAt: "2026-07-23T15:00:00.000Z",
          closesAt: "2026-07-24T00:50:00.000Z",
          candidates: [baseCandidate],
        },
        "2026-07-23",
      ),
    /exactly two/,
  );
});

test("candidate validation rejects unsupported effects and unsafe URLs", () => {
  assert.equal(validateCandidate(baseCandidate).effect, "no_effect");
  assert.throws(
    () => validateCandidate({ ...baseCandidate, effect: "flash" }),
    /Unsupported effect/,
  );
  assert.throws(
    () =>
      validateCandidate({
        ...baseCandidate,
        sourceUrl: "http://example.org/day",
      }),
    /HTTPS/,
  );
});

test("applied themes validate vote counts and public status", () => {
  const theme = validateThemePayload(
    {
      ...baseCandidate,
      selectedCandidateId: baseCandidate.id,
      selectedVoteCount: 4,
      totalVoteCount: 7,
      publicStatus: "active",
    },
    "2026-07-23",
  );
  assert.equal(theme.totalVoteCount, 7);
  assert.throws(
    () =>
      validateThemePayload(
        {
          ...baseCandidate,
          selectedVoteCount: 8,
          totalVoteCount: 7,
          publicStatus: "active",
        },
        "2026-07-23",
      ),
    /Vote counts/,
  );
});

test("date validation rejects impossible and malformed dates", () => {
  assert.equal(isIsoDate("2026-07-23"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("07-23-2026"), false);
});
