import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Patagonia Wings Web",
  description: "Centro de operaciones web Patagonia Wings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="grid-overlay min-h-screen" suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
