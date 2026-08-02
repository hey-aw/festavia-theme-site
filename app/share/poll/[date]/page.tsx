import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  const image = `/api/share/poll/${date}/image`;
  return { title: "Vote for tonight's light | The House with the Pink Door", description: "Choose tonight's public theme at The House with the Pink Door.", openGraph: { title: "Vote for tonight's light", description: "Choose tonight's public theme at The House with the Pink Door.", images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", title: "Vote for tonight's light", images: [image] } };
}

export default async function PollSharePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return <main className="share-page"><Image unoptimized src={`/api/share/poll/${date}/image`} width="1200" height="630" alt="Daily voting preview for The House with the Pink Door" /><p><Link href="/">Visit The House with the Pink Door</Link></p></main>;
}
