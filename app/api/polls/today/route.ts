import { NextRequest } from "next/server";
import {
  candidatesForDate,
  pollForDate,
  themeForDate,
  voteForVoter,
} from "@/lib/data";
import { pacificDate, phaseForPoll } from "@/lib/pacific-time";
import { voterIdentity } from "@/lib/security";
import type { PublicPoll } from "@/lib/theme-types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const now = new Date();
  const date = pacificDate(now);
  const [poll, appliedTheme] = await Promise.all([
    pollForDate(date),
    themeForDate(date),
  ]);
  const identity = await voterIdentity(request, date);

  if (!poll) {
    const payload: PublicPoll = {
      date,
      opensAt: null,
      closesAt: null,
      phase: appliedTheme ? "complete" : "not_scheduled",
      candidates: [],
      yourVote: null,
      shareUrl: `${request.nextUrl.origin}/share/poll/${date}`,
      imageUrl: `${request.nextUrl.origin}/api/share/poll/${date}/image`,
    };
    const headers = new Headers({ "Cache-Control": "private, no-store" });
    if (identity.setCookie) headers.set("Set-Cookie", identity.setCookie);
    return Response.json(payload, { headers });
  }

  const phase = phaseForPoll(
    now,
    poll.opensAt,
    poll.closesAt,
    Boolean(appliedTheme),
  );
  const [candidates, yourVote] = await Promise.all([
    candidatesForDate(date),
    voteForVoter(date, identity.voterHash),
  ]);
  const revealCounts =
    yourVote !== null || phase === "preparing" || phase === "complete";
  const payload: PublicPoll = {
    date,
    opensAt: poll.opensAt,
    closesAt: poll.closesAt,
    phase,
    candidates: candidates.map((candidate) => {
      if (revealCounts) return candidate;
      return {
        id: candidate.id,
        preferenceRank: candidate.preferenceRank,
        observanceName: candidate.observanceName,
        observanceSynopsis: candidate.observanceSynopsis,
        sourceUrl: candidate.sourceUrl,
        palette: candidate.palette,
        mode: candidate.mode,
        effect: candidate.effect,
        lightingSynopsis: candidate.lightingSynopsis,
        fallbackPalette: candidate.fallbackPalette,
      };
    }),
    yourVote,
    shareUrl: `${request.nextUrl.origin}/share/poll/${date}`,
    imageUrl: `${request.nextUrl.origin}/api/share/poll/${date}/image`,
  };
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  if (identity.setCookie) headers.set("Set-Cookie", identity.setCookie);
  return Response.json(payload, { headers });
}
