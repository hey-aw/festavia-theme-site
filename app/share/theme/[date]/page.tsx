import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  const image = `/api/share/theme/${date}/image`;
  return { title: "Tonight's light | The House with the Pink Door", description: "See the applied public theme from The House with the Pink Door.", openGraph: { title: "Tonight's light", description: "See the applied public theme from The House with the Pink Door.", images: [{ url: image, width: 1200, height: 630, type: "image/svg+xml" }] }, twitter: { card: "summary_large_image", title: "Tonight's light", images: [image] } };
}

export default async function ThemeSharePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <main className="share-page"><img src={`/api/share/theme/${date}/image`} width="1200" height="630" alt="Applied theme preview for The House with the Pink Door" /><p><a href="/">Visit The House with the Pink Door</a></p></main>;
}
