import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Chat",
  description: "A minimal streaming chat built with Next.js and the Vercel AI SDK",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
