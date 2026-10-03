import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sprout",
  description: "See the progress you're already making.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=IM+Fell+English&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
