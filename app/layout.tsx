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

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "Field Notes — Powered by Kujo CMS",
    template: "%s — Field Notes",
  },
  description: "An independent publication about building software with clarity, context, and control.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Field Notes — Powered by Kujo CMS",
    description: "An independent publication about building software with clarity, context, and control.",
    type: "website",
    images: [{ url: "/og.webp", width: 1731, height: 909, alt: "Field Notes — Ideas with enough room to become useful." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Field Notes — Powered by Kujo CMS",
    description: "An independent publication about building software with clarity, context, and control.",
    images: ["/og.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
