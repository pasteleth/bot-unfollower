import type { Metadata } from "next";
// Temporarily removing CSS import to fix build issues
// import "./globals.css";

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
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
