import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zonecheck — which Copenhagen fare zone am I in?",
  description:
    "Free, no login, no tickets. An estimate of your Copenhagen fare zone derived from open data. Not an official DOT source.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The map needs pinch-zoom, and blocking it would break accessibility.
  maximumScale: 5,
  themeColor: "#0F4429",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
