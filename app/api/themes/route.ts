import { NextRequest } from "next/server";
import { listThemes } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 7);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(7, Math.max(1, requestedLimit))
    : 7;
  const themes = (await listThemes(limit)).map((theme) => ({
    ...theme,
    shareUrl: `${request.nextUrl.origin}/share/theme/${theme.date}`,
    imageUrl: `${request.nextUrl.origin}/api/share/theme/${theme.date}/image`,
  }));
  return Response.json(
    { themes },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
