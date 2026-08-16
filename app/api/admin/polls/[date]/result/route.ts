import { NextRequest } from "next/server";
import {
  enqueuePollClosedNotification,
  pollForDate,
  rankedPollResult,
} from "@/lib/data";
import { scheduleDiscordNotificationDrain } from "@/lib/discord-notification-scheduler";
import { shouldEnqueuePollClosed } from "@/lib/discord-notification-types";
import { requirePublisher } from "@/lib/security";
import { isIsoDate } from "@/lib/pacific-time";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ date: string }> },
) {
  const unauthorized = await requirePublisher(request);
  if (unauthorized) return unauthorized;
  const { date } = await context.params;
  if (!isIsoDate(date)) {
    return Response.json({ error: "Invalid date." }, { status: 400 });
  }
  const poll = await pollForDate(date);
  if (!poll) {
    return Response.json({ error: "Poll not found." }, { status: 404 });
  }
  if (shouldEnqueuePollClosed(new Date(), poll.closesAt)) {
    await enqueuePollClosedNotification(date);
  }
  const rankedCandidates = await rankedPollResult(date);
  const response = Response.json({
    date,
    opensAt: poll.opensAt,
    closesAt: poll.closesAt,
    winner: rankedCandidates[0] ?? null,
    alternate: rankedCandidates[1] ?? null,
    totalVoteCount: rankedCandidates.reduce(
      (sum, candidate) => sum + candidate.voteCount,
      0,
    ),
  });
  scheduleDiscordNotificationDrain();
  return response;
}
