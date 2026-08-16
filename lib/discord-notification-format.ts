export type PollNotificationCandidate = {
  observanceName: string;
  voteCount: number;
};

export type PollNotificationResult = {
  date: string;
  winner: PollNotificationCandidate;
  alternate: PollNotificationCandidate;
  totalVoteCount: number;
};

export type VoteNotificationResult = {
  date: string;
  observanceName: string;
  candidateVoteCount: number;
  totalVoteCount: number;
};

function voteLabel(count: number): string {
  return `${count} ${count === 1 ? "vote" : "votes"}`;
}

export function formatVoteNotification(
  event: VoteNotificationResult,
): string {
  return [
    "New Pink Door vote",
    `Date: ${event.date}`,
    `Choice: ${event.observanceName}`,
    `Current tally: ${voteLabel(event.candidateVoteCount)} for this choice, ${voteLabel(event.totalVoteCount)} total`,
    "Voting closes: 5:50 PM Pacific",
  ].join("\n");
}

export function formatPollOpenedNotification(
  poll: PollNotificationResult,
  baseUrl: string,
): string {
  return [
    "Pink Door voting is open",
    "Today's choices:",
    `- ${poll.winner.observanceName}`,
    `- ${poll.alternate.observanceName}`,
    "Voting closes: 5:50 PM Pacific",
    `Vote: ${baseUrl}`,
  ].join("\n");
}

export function formatPollClosedNotification(
  poll: PollNotificationResult,
): string {
  const tied = poll.winner.voteCount === poll.alternate.voteCount;
  const outcome =
    poll.totalVoteCount === 0
      ? `No votes were cast; today's preference selected ${poll.winner.observanceName}.`
      : tied
        ? `The vote tied; today's preference selected ${poll.winner.observanceName}.`
        : `Winning choice: ${poll.winner.observanceName}`;
  return [
    "Pink Door voting is closed",
    outcome,
    "Final tally:",
    `- ${poll.winner.observanceName}: ${voteLabel(poll.winner.voteCount)}`,
    `- ${poll.alternate.observanceName}: ${voteLabel(poll.alternate.voteCount)}`,
    "Tonight's display is scheduled for 6:00 PM Pacific.",
  ].join("\n");
}
