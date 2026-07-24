import type { ThemeCandidate } from "./theme-types";

type ResultCandidate = Pick<ThemeCandidate, "id" | "observanceName"> & {
  voteCount?: number;
};

export function summarizePollResults<T extends ResultCandidate>(
  candidates: T[],
): {
  results: Array<{
    candidate: T;
    voteCount: number | null;
    percentage: number;
  }>;
  countsAvailable: boolean;
  totalVotes: number;
  highestVoteCount: number;
  leaderIds: string[];
} {
  const normalized = candidates.map((candidate) => {
    const voteCount =
      typeof candidate.voteCount === "number" &&
      Number.isFinite(candidate.voteCount) &&
      candidate.voteCount >= 0
        ? Math.floor(candidate.voteCount)
        : null;
    return { candidate, voteCount };
  });
  const countsAvailable =
    normalized.length > 0 &&
    normalized.every((result) => result.voteCount !== null);
  const totalVotes = normalized.reduce(
    (total, result) => total + (result.voteCount ?? 0),
    0,
  );
  const results = normalized.map((result) => ({
    ...result,
    percentage:
      countsAvailable && totalVotes > 0
        ? Math.round(((result.voteCount ?? 0) / totalVotes) * 100)
        : 0,
  }));
  const highestVoteCount =
    results.length > 0
      ? Math.max(...results.map((result) => result.voteCount ?? 0))
      : 0;
  const leaderIds =
    countsAvailable && totalVotes > 0
      ? results
          .filter((result) => result.voteCount === highestVoteCount)
          .map((result) => result.candidate.id)
      : [];
  return {
    results,
    countsAvailable,
    totalVotes,
    highestVoteCount,
    leaderIds,
  };
}
