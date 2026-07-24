import { NextRequest } from "next/server";
import { upsertAppliedTheme } from "@/lib/data";
import { requirePublisher } from "@/lib/security";
import { validateThemePayload } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ date: string }> },
) {
  const unauthorized = await requirePublisher(request);
  if (unauthorized) return unauthorized;
  const { date } = await context.params;

  try {
    const theme = validateThemePayload(await request.json(), date);
    await upsertAppliedTheme(theme);
    return Response.json({ ok: true, date });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to publish theme.";
    return Response.json({ error: message }, { status: 400 });
  }
}
