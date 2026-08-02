import { candidatesForDate } from "@/lib/data";
import { isIsoDate } from "@/lib/pacific-time";
import { renderPollCard } from "@/lib/social-preview";
import { readSocialAsset } from "@/lib/social-assets";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ date: string }> }) {
  const { date } = await context.params;
  if (!isIsoDate(date)) return new Response("Not found", { status: 404 });
  const asset = await readSocialAsset(date, "poll");
  if (asset) {
    const headers = new Headers({
      "Content-Type": asset.httpMetadata?.contentType ?? "image/png",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      ETag: asset.httpEtag,
    });
    return new Response(asset.body, { headers });
  }
  const candidates = await candidatesForDate(date);
  const svg = renderPollCard({ date, candidates: candidates.length === 2 ? candidates : [] });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=300" } });
}
