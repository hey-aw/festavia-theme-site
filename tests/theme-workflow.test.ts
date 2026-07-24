import assert from "node:assert/strict";
import test from "node:test";
import {
  isIsoDate,
  pacificDate,
  pacificInstant,
  phaseForPoll,
} from "../lib/pacific-time";
import {
  validateCandidate,
  validatePollPayload,
  validateThemePayload,
} from "../lib/validation";
import { summarizePollResults } from "../lib/poll-results";

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
  assert.equal(pacificInstant("2026-03-08", 8, 0), "2026-03-08T15:00:00.000Z");
  assert.equal(pacificInstant("2026-03-08", 17, 50), "2026-03-09T00:50:00.000Z");
  assert.equal(pacificInstant("2026-11-01", 8, 0), "2026-11-01T16:00:00.000Z");
  assert.equal(pacificInstant("2026-11-01", 17, 50), "2026-11-02T01:50:00.000Z");
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
  assert.throws(
    () =>
      validatePollPayload(
        {
          opensAt: "2026-07-23T15:01:00.000Z",
          closesAt: "2026-07-24T00:50:00.000Z",
          candidates: [
            baseCandidate,
            {
              ...baseCandidate,
              id: "vanilla-ice-cream-day",
              preferenceRank: 2,
            },
          ],
        },
        "2026-07-23",
      ),
    /08:00.*17:50/,
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
  assert.deepEqual(
    validateCandidate({
      ...baseCandidate,
      mode: "Hue effect",
      effect: "prism",
      palette: [],
    }).palette,
    [],
  );
  assert.throws(
    () =>
      validateCandidate({
        ...baseCandidate,
        mode: "Hue effect",
        effect: "prism",
        palette: [
          { name: "First tint", hex: "#123456" },
          { name: "Second tint", hex: "#654321" },
        ],
      }),
    /0-1 colors/,
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
  assert.equal(
    validateThemePayload(
      {
        ...baseCandidate,
        mode: "Hue effect",
        effect: "prism",
        palette: [],
        publicStatus: "active",
        selectedCandidateId: baseCandidate.id,
      },
      "2026-07-23",
    ).palette.length,
    0,
  );
});

test("poll result summaries handle leaders, ties, and unavailable counts", () => {
  const candidates = [
    { id: "first-theme", observanceName: "First Theme", voteCount: 2 },
    { id: "second-theme", observanceName: "Second Theme", voteCount: 1 },
  ];
  assert.deepEqual(summarizePollResults(candidates), {
    results: [
      { candidate: candidates[0], voteCount: 2, percentage: 67 },
      { candidate: candidates[1], voteCount: 1, percentage: 33 },
    ],
    countsAvailable: true,
    totalVotes: 3,
    highestVoteCount: 2,
    leaderIds: ["first-theme"],
  });

  const tied = summarizePollResults([
    { ...candidates[0], voteCount: 1 },
    { ...candidates[1], voteCount: 1 },
  ]);
  assert.deepEqual(tied.leaderIds, ["first-theme", "second-theme"]);
  assert.deepEqual(
    tied.results.map((result) => result.percentage),
    [50, 50],
  );

  const unavailable = summarizePollResults([
    { id: "first-theme", observanceName: "First Theme" },
    { id: "second-theme", observanceName: "Second Theme", voteCount: 1 },
  ]);
  assert.equal(unavailable.countsAvailable, false);
  assert.deepEqual(unavailable.leaderIds, []);
  assert.deepEqual(
    unavailable.results.map((result) => result.percentage),
    [0, 0],
  );
});

test("date validation rejects impossible and malformed dates", () => {
  assert.equal(isIsoDate("2026-07-23"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("07-23-2026"), false);
});
