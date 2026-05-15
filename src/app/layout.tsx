import type { Metadata } from "next";
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
      <body className="pw-sky-site grid-overlay ui-light-windows min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
