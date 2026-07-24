import { NextRequest } from "next/server";
import { upsertPoll } from "@/lib/data";
import { requirePublisher } from "@/lib/security";
import { validatePollPayload } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ date: string }> },
) {
  const unauthorized = await requirePublisher(request);
  if (unauthorized) return unauthorized;
  const { date } = await context.params;

  try {
    const payload = validatePollPayload(await request.json(), date);
    await upsertPoll({ date, ...payload });
    return Response.json({ ok: true, date });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to publish poll.";
    const status =
      message === "ACTIVE_POLL_CANDIDATES_CANNOT_CHANGE" ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}
