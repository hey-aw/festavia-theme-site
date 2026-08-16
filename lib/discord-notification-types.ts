export type DiscordNotificationEventType =
  | "poll_opened"
  | "vote_cast"
  | "poll_closed";

export type ClaimedDiscordNotification = {
  eventId: string;
  date: string;
  eventType: DiscordNotificationEventType;
  candidateId: string | null;
  createdAt: string;
  claimToken: string;
  attemptCount: number;
};

export function discordNotificationDedupeKey(
  eventType: DiscordNotificationEventType,
  date: string,
  voterHash?: string,
): string {
  if (eventType === "vote_cast") {
    if (!voterHash) throw new Error("vote_cast requires a voter hash.");
    return `vote_cast:${date}:${voterHash}`;
  }
  return `${eventType}:${date}`;
}

export function shouldEnqueuePollClosed(
  now: Date,
  closesAt: string,
): boolean {
  const closesAtMs = Date.parse(closesAt);
  return Number.isFinite(closesAtMs) && now.getTime() >= closesAtMs;
}
