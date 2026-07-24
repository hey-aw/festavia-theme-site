import { NextRequest } from "next/server";
import { castVote, pollForDate } from "@/lib/data";
import { pacificDate, phaseForPoll } from "@/lib/pacific-time";
import { voterIdentity } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const now = new Date();
  const date = pacificDate(now);
  const poll = await pollForDate(date);
  if (!poll) {
    return Response.json({ error: "Voting is not scheduled." }, { status: 404 });
  }
  if (phaseForPoll(now, poll.opensAt, poll.closesAt, false) !== "open") {
    return Response.json({ error: "Voting is closed." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const candidateId =
    typeof body === "object" &&
    body !== null &&
    typeof (body as Record<string, unknown>).candidateId === "string"
      ? (body as Record<string, string>).candidateId
      : "";
  if (!candidateId) {
    return Response.json({ error: "candidateId is required." }, { status: 400 });
  }

  const identity = await voterIdentity(request, date);
  try {
    await castVote({
      date,
      voterHash: identity.voterHash,
      rateHash: identity.rateHash,
      candidateId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return Response.json(
        { error: "Too many voting attempts today." },
        { status: 429 },
      );
    }
    if (error instanceof Error && error.message === "INVALID_CANDIDATE") {
      return Response.json({ error: "Candidate not found." }, { status: 404 });
    }
    throw error;
  }

  const headers = new Headers({ "Cache-Control": "private, no-store" });
  if (identity.setCookie) headers.set("Set-Cookie", identity.setCookie);
  return Response.json({ ok: true, candidateId }, { headers });
}
