import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDiscordMessage,
  formatPollClosedMessage,
  formatPollOpenedMessage,
  normalizeDaemonState,
  pacificDate,
  pollPhase,
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

const poll = {
  date: "2026-07-24",
  opensAt: "2026-07-24T15:00:00.000Z",
  closesAt: "2026-07-25T00:50:00.000Z",
  winner: { observanceName: "National Mustard Day", voteCount: 3 },
  alternate: { observanceName: "Fermentation Celebration", voteCount: 2 },
  totalVoteCount: 5,
};

test("daemon formats public-safe poll opening and closing messages", () => {
  assert.equal(
    formatPollOpenedMessage(poll, "https://house-with-pink-door.example"),
    [
      "Pink Door voting is open",
      "Today's choices:",
      "- National Mustard Day",
      "- Fermentation Celebration",
      "Voting closes: 5:50 PM Pacific",
      "Vote: https://house-with-pink-door.example",
    ].join("\n"),
  );
  assert.equal(
    formatPollClosedMessage(poll),
    [
      "Pink Door voting is closed",
      "Winning choice: National Mustard Day",
      "Final tally:",
      "- National Mustard Day: 3 votes",
      "- Fermentation Celebration: 2 votes",
      "Tonight's display is scheduled for 6:00 PM Pacific.",
    ].join("\n"),
  );
});

test("daemon handles tie and no-vote poll outcomes without inventing a winner", () => {
  assert.match(
    formatPollClosedMessage({
      ...poll,
      winner: { ...poll.winner, voteCount: 1 },
      alternate: { ...poll.alternate, voteCount: 1 },
      totalVoteCount: 2,
    }),
    /The vote tied; today's preference selected National Mustard Day\./,
  );
  assert.match(
    formatPollClosedMessage({
      ...poll,
      winner: { ...poll.winner, voteCount: 0 },
      alternate: { ...poll.alternate, voteCount: 0 },
      totalVoteCount: 0,
    }),
    /No votes were cast; today's preference selected National Mustard Day\./,
  );
});

test("daemon derives lifecycle phase from canonical poll timestamps", () => {
  assert.equal(pollPhase(new Date("2026-07-24T14:59:59Z"), poll), "scheduled");
  assert.equal(pollPhase(new Date("2026-07-24T15:00:00Z"), poll), "open");
  assert.equal(pollPhase(new Date("2026-07-25T00:50:00Z"), poll), "closed");
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
      pollOpenedDate: null,
      pollClosedDate: null,
    },
  );
});

test("daemon state keeps only valid lifecycle dates", () => {
  assert.deepEqual(
    normalizeDaemonState({
      pollOpenedDate: "2026-07-24",
      pollClosedDate: "private-data",
    }),
    {
      sentUnacknowledged: [],
      lastSuccessfulDelivery: null,
      pollOpenedDate: "2026-07-24",
      pollClosedDate: null,
    },
  );
});
