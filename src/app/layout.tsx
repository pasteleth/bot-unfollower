import type { Metadata } from "next";
// Import from our utility file instead
import { inter } from "@/lib/fonts";
// Temporarily removing CSS import to fix build issues
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Bot Detector Frame",
  description: "Detect bot followers on Farcaster",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
