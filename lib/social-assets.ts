import { socialAssets } from "./runtime-env";

export type SocialAssetKind = "poll" | "theme";

export function socialAssetKey(date: string, kind: SocialAssetKind): string {
  return `social/${date}/${kind}.png`;
}

export async function readSocialAsset(
  date: string,
  kind: SocialAssetKind,
): Promise<R2ObjectBody | null> {
  const bucket = socialAssets();
  if (!bucket) return null;
  return bucket.get(socialAssetKey(date, kind));
}

export async function writeSocialAsset(
  date: string,
  kind: SocialAssetKind,
  body: ArrayBuffer,
): Promise<void> {
  const bucket = socialAssets();
  if (!bucket) throw new Error("Social asset storage is unavailable.");
  await bucket.put(socialAssetKey(date, kind), body, {
    httpMetadata: {
      contentType: "image/png",
      cacheControl: "public, max-age=300",
    },
    customMetadata: { date, kind },
  });
}
