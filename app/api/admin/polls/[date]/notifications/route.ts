import { NextRequest } from "next/server";
import {
  markVoteNotificationDelivered,
  pendingVoteNotifications,
} from "@/lib/data";
import { isIsoDate } from "@/lib/pacific-time";
import { requirePublisher } from "@/lib/security";

export const dynamic = "force-dynamic";

const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const events = await pendingVoteNotifications(date);
  return Response.json(
    { date, events },
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
  const eventId =
    typeof body === "object" &&
    body !== null &&
    typeof (body as Record<string, unknown>).eventId === "string"
      ? (body as Record<string, string>).eventId
      : "";
  if (!EVENT_ID.test(eventId)) {
    return Response.json({ error: "Valid eventId is required." }, { status: 400 });
  }

  const acknowledged = await markVoteNotificationDelivered(date, eventId);
  if (!acknowledged) {
    return Response.json({ error: "Notification event not found." }, { status: 404 });
  }
  return Response.json({ ok: true, date, eventId });
}
