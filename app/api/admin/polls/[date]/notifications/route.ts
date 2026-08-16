import { NextRequest } from "next/server";
import { discordNotificationStatusForDate } from "@/lib/data";
import { scheduleDiscordNotificationDrain } from "@/lib/discord-notification-scheduler";
import { isIsoDate } from "@/lib/pacific-time";
import { requirePublisher } from "@/lib/security";

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
  const events = await discordNotificationStatusForDate(date);
  const pendingCount = events.filter((event) => !event.deliveredAt).length;
  return Response.json(
    { date, pendingCount, events },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ date: string }> },
) {
  const unauthorized = await requirePublisher(request);
  if (unauthorized) return unauthorized;
  const { date } = await context.params;
  if (!isIsoDate(date)) {
    return Response.json({ error: "Invalid date." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const action =
    typeof body === "object" &&
    body !== null &&
    typeof (body as Record<string, unknown>).action === "string"
      ? (body as Record<string, string>).action
      : "";
  if (action !== "retry") {
    return Response.json(
      { error: 'action must be "retry".' },
      { status: 400 },
    );
  }

  scheduleDiscordNotificationDrain();
  return Response.json({ ok: true, date, scheduled: true }, { status: 202 });
}
