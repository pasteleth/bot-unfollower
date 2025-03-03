import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
