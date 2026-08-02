import { requirePublisher } from "@/lib/security";
import { isIsoDate } from "@/lib/pacific-time";
import { writeSocialAsset, type SocialAssetKind } from "@/lib/social-assets";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function PUT(
  request: Request,
  context: { params: Promise<{ date: string; kind: string }> },
) {
  const unauthorized = await requirePublisher(request);
  if (unauthorized) return unauthorized;
  const { date, kind } = await context.params;
  if (!isIsoDate(date) || !["poll", "theme"].includes(kind)) {
    return Response.json({ error: "Invalid social preview target." }, { status: 400 });
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "image/png") {
    return Response.json({ error: "Social previews must be PNG images." }, { status: 415 });
  }
  const body = await request.arrayBuffer();
  if (body.byteLength < 1 || body.byteLength > MAX_IMAGE_BYTES) {
    return Response.json({ error: "Social preview size is invalid." }, { status: 413 });
  }
  await writeSocialAsset(date, kind as SocialAssetKind, body);
  return Response.json({ ok: true, date, kind });
}
