import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sprout",
  description: "See the progress you're already making.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
