import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "XAMO AI — A little more possible.",
  description:
    "Your personal space to think, create, and discover. XAMO AI, created by Zaeem.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
