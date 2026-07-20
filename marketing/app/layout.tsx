import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const canonicalUrl = "https://jobsmatchnow.com";

export const metadata: Metadata = {
    metadataBase: new URL(canonicalUrl),
    title: "JobsMatchNow",
    description: "Stop chasing jobs and candidates. Let the perfect role—or candidate—chase you through mutual, explainable matching.",
    alternates: { canonical: "/" },
    icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/logo.png" },
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      url: "/",
      siteName: "JobsMatchNow",
      title: "JobsMatchNow — Let the perfect match chase you.",
      description: "Mutual, explainable matching for job seekers and hiring teams.",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "JobsMatchNow — Let the perfect match chase you." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "JobsMatchNow — Let the perfect match chase you.",
      description: "Mutual, explainable matching for job seekers and hiring teams.",
      images: ["/og.png"],
    },
};

const productSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "JobsMatchNow",
  url: canonicalUrl,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Windows, macOS, iOS, Android",
  description: "Mutual, explainable matching for job seekers and hiring teams.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", category: "Candidate access" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" id="top">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
        {children}
      </body>
    </html>
  );
}
