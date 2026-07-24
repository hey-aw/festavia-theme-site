import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDiscordMessage,
  normalizeDaemonState,
  pacificDate,
} from "../scripts/pink-door-vote-notification-daemon.mjs";

test("daemon formats a public-safe Discord notification", () => {
  assert.equal(
    formatDiscordMessage({
      date: "2026-07-24",
      observanceName: "World Brain Day",
      candidateVoteCount: 1,
      totalVoteCount: 2,
    }),
    [
      "New Pink Door vote",
      "Date: 2026-07-24",
      "Choice: World Brain Day",
      "Current tally: 1 vote for this choice, 2 votes total",
      "Voting closes: 5:50 PM Pacific",
    ].join("\n"),
  );
});

test("daemon computes the current date in America/Los_Angeles", () => {
  assert.equal(pacificDate(new Date("2026-07-24T06:59:59Z")), "2026-07-23");
  assert.equal(pacificDate(new Date("2026-07-24T07:00:00Z")), "2026-07-24");
});

test("daemon state retains only unique event IDs", () => {
  const eventId = "c59425dd-6f4e-4d7b-b42c-a7b8fae43c68";
  assert.deepEqual(
    normalizeDaemonState({
      sentUnacknowledged: [eventId, "private-data", eventId],
      lastSuccessfulDelivery: "2026-07-24T20:00:00.000Z",
      chatId: "must-not-persist",
    }),
    {
      sentUnacknowledged: [eventId],
      lastSuccessfulDelivery: "2026-07-24T20:00:00.000Z",
    },
  );
});
