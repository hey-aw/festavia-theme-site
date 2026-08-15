import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { headers } from "next/headers";
import { rootSocialPreview } from "@/lib/social-metadata";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const social = rootSocialPreview();

  return {
    metadataBase,
    title: "The House with the Pink Door",
    description:
      "Vote for tonight's verified observance theme and see the colors lighting The House with the Pink Door.",
    openGraph: {
      title: social.title,
      description: social.description,
      images: [{ url: social.image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: social.title,
      description: social.description,
      images: [social.image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${fraunces.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
