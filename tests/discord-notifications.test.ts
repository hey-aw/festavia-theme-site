import assert from "node:assert/strict";
import test from "node:test";
import {
  DiscordNotificationError,
  discordNotificationLeaseMilliseconds,
  drainDiscordNotificationBatch,
  notificationNonce,
  sendDiscordDm,
  type DiscordNotificationStore,
} from "../lib/discord-notification-core";
import {
  formatPollClosedNotification,
  formatPollOpenedNotification,
  formatVoteNotification,
} from "../lib/discord-notification-format";
import {
  discordNotificationDedupeKey,
  shouldEnqueuePollClosed,
  type ClaimedDiscordNotification,
} from "../lib/discord-notification-types";

const poll = {
  date: "2026-07-24",
  winner: { observanceName: "National Mustard Day", voteCount: 3 },
  alternate: { observanceName: "Fermentation Celebration", voteCount: 2 },
  totalVoteCount: 5,
};

const event: ClaimedDiscordNotification = {
  eventId: "c59425dd-6f4e-4d7b-b42c-a7b8fae43c68",
  date: "2026-07-24",
  eventType: "vote_cast",
  candidateId: "national-mustard-day",
  createdAt: "2026-07-24T20:00:00.000Z",
  claimToken: "55cb468e-8508-4ad9-9c36-d74eaac5a7c8",
  attemptCount: 1,
};

test("formats the existing open, vote, and close messages", () => {
  assert.equal(
    formatVoteNotification({
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
  assert.equal(
    formatPollOpenedNotification(
      poll,
      "https://house-with-pink-door.example",
    ),
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
    formatPollClosedNotification(poll),
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

test("formats tie and no-vote outcomes without inventing a winner", () => {
  assert.match(
    formatPollClosedNotification({
      ...poll,
      winner: { ...poll.winner, voteCount: 1 },
      alternate: { ...poll.alternate, voteCount: 1 },
      totalVoteCount: 2,
    }),
    /The vote tied; today's preference selected National Mustard Day\./,
  );
  assert.match(
    formatPollClosedNotification({
      ...poll,
      winner: { ...poll.winner, voteCount: 0 },
      alternate: { ...poll.alternate, voteCount: 0 },
      totalVoteCount: 0,
    }),
    /No votes were cast; today's preference selected National Mustard Day\./,
  );
});

test("dedupe keys are stable and close events wait for the canonical close", () => {
  assert.equal(
    discordNotificationDedupeKey("poll_opened", "2026-07-24"),
    "poll_opened:2026-07-24",
  );
  assert.equal(
    discordNotificationDedupeKey(
      "vote_cast",
      "2026-07-24",
      "anonymous-voter-hash",
    ),
    "vote_cast:2026-07-24:anonymous-voter-hash",
  );
  assert.equal(
    shouldEnqueuePollClosed(
      new Date("2026-07-25T00:49:59.999Z"),
      "2026-07-25T00:50:00.000Z",
    ),
    false,
  );
  assert.equal(
    shouldEnqueuePollClosed(
      new Date("2026-07-25T00:50:00.000Z"),
      "2026-07-25T00:50:00.000Z",
    ),
    true,
  );
});

test("Discord delivery disables mentions and enforces the event nonce", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImplementation = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return requests.length === 1
      ? Response.json({ id: "dm-channel" })
      : Response.json({ id: "discord-message" });
  }) as typeof fetch;
  const nonce = notificationNonce(event.eventId);
  const messageId = await sendDiscordDm("public notification", nonce, {
    botToken: "private-token",
    recipientId: "123456789012345678",
    fetchImplementation,
  });

  assert.equal(messageId, "discord-message");
  assert.equal(nonce.length, 25);
  assert.equal(requests.length, 2);
  const body = JSON.parse(String(requests[1]?.init?.body));
  assert.deepEqual(body.allowed_mentions, { parse: [] });
  assert.equal(body.nonce, nonce);
  assert.equal(body.enforce_nonce, true);
});

test("Discord failures expose only sanitized codes", async () => {
  const secretBody = "private-token-and-response-body";
  const fetchImplementation = (async () =>
    new Response(secretBody, { status: 503 })) as typeof fetch;
  await assert.rejects(
    sendDiscordDm("public notification", notificationNonce(event.eventId), {
      botToken: "private-token",
      recipientId: "123456789012345678",
      fetchImplementation,
    }),
    (error: unknown) => {
      assert.ok(error instanceof DiscordNotificationError);
      assert.equal(error.code, "DISCORD_HTTP_503");
      assert.doesNotMatch(error.message, /private-token|response-body/);
      return true;
    },
  );
});

test("Discord timeouts remain retryable without leaking request data", async () => {
  const fetchImplementation = (async () => {
    throw new DOMException("private timeout details", "TimeoutError");
  }) as typeof fetch;
  await assert.rejects(
    sendDiscordDm("public notification", notificationNonce(event.eventId), {
      botToken: "private-token",
      recipientId: "123456789012345678",
      fetchImplementation,
    }),
    (error: unknown) => {
      assert.ok(error instanceof DiscordNotificationError);
      assert.equal(error.code, "DISCORD_TIMEOUT");
      assert.doesNotMatch(error.message, /private|timeout details/);
      return true;
    },
  );
});

function queuedStore(
  queue: ClaimedDiscordNotification[],
  delivered: string[],
  released: string[],
): DiscordNotificationStore {
  return {
    claimNext: async (_now, leaseMilliseconds) => {
      assert.equal(leaseMilliseconds, discordNotificationLeaseMilliseconds);
      return queue.shift() ?? null;
    },
    markDelivered: async (claimed, messageId) => {
      delivered.push(`${claimed.eventId}:${messageId}`);
      return true;
    },
    release: async (claimed, code) => {
      released.push(`${claimed.eventId}:${code}`);
      return true;
    },
  };
}

test("the outbox marks successful delivery and releases failed claims", async () => {
  const delivered: string[] = [];
  const released: string[] = [];
  const result = await drainDiscordNotificationBatch({
    store: queuedStore([event, { ...event, eventId: crypto.randomUUID() }], delivered, released),
    sender: async (_content, nonce) => {
      if (delivered.length === 0) return `message-${nonce}`;
      throw new DiscordNotificationError("DISCORD_HTTP_429");
    },
    render: async () => "public notification",
    now: () => new Date("2026-07-24T20:00:00.000Z"),
  });

  assert.deepEqual(result, { claimed: 2, delivered: 1, failed: 1 });
  assert.equal(delivered.length, 1);
  assert.match(released[0] ?? "", /DISCORD_HTTP_429$/);
});

test("concurrent drains cannot deliver one atomically claimed event twice", async () => {
  const queue = [event];
  const delivered: string[] = [];
  const released: string[] = [];
  const store = queuedStore(queue, delivered, released);
  let sends = 0;
  const drain = () =>
    drainDiscordNotificationBatch({
      store,
      sender: async () => {
        sends += 1;
        return "discord-message";
      },
      render: async () => "public notification",
      limit: 1,
    });

  await Promise.all([drain(), drain()]);
  assert.equal(sends, 1);
  assert.equal(delivered.length, 1);
  assert.deepEqual(released, []);
});

test("an expired two-minute claim is eligible for retry", async () => {
  const claimedAt = Date.parse("2026-07-24T19:57:59.999Z");
  const now = new Date("2026-07-24T20:00:00.000Z");
  let available = true;
  const delivered: string[] = [];
  const store: DiscordNotificationStore = {
    claimNext: async (claimNow, leaseMilliseconds) => {
      if (
        available &&
        claimNow.getTime() - claimedAt > leaseMilliseconds
      ) {
        available = false;
        return event;
      }
      return null;
    },
    markDelivered: async (claimed) => {
      delivered.push(claimed.eventId);
      return true;
    },
    release: async () => true,
  };
  await drainDiscordNotificationBatch({
    store,
    sender: async () => "discord-message",
    render: async () => "public notification",
    now: () => now,
  });
  assert.deepEqual(delivered, [event.eventId]);
});
