import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RETENZA — Inteligência operacional de retenção", template: "%s · RETENZA" },
  description:
    "Identifique o risco de cancelamento, entenda o motivo e aja antes da perda. Plataforma de retenção para provedores de internet.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1220",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
