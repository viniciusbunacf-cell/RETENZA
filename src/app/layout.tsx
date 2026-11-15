import type { Metadata, Viewport } from "next";
import { figtree, sora } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RETENZA — Inteligência operacional de retenção", template: "%s · RETENZA" },
  description:
    "Identifique o risco de cancelamento, entenda o motivo e aja antes da perda. Plataforma de retenção para provedores de internet.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#141b26",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${figtree.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
