"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Inbox,
  Plug,
  Radar,
  Settings,
  X,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Logo, cn } from "./ui";

const NAV = [
  { href: "/painel", label: "Dashboard", icon: LayoutDashboard },
  { href: "/radar", label: "Radar de risco", icon: Radar },
  { href: "/regioes", label: "Inteligência geográfica", icon: MapPinned },
  { href: "/acoes", label: "Central de ações", icon: ClipboardList },
  { href: "/indicadores", label: "Indicadores de retenção", icon: BarChart3 },
  { href: "/integracoes", label: "Integrações", icon: Plug },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/painel") return pathname === "/painel";
  if (href === "/radar") return pathname.startsWith("/radar") || pathname.startsWith("/clientes");
  return pathname.startsWith(href);
}

export function Sidebar({
  providerName,
  userName,
  roleLabel,
  openActions,
  showLeads = false,
}: {
  providerName: string;
  userName: string;
  roleLabel: string;
  openActions: number;
  showLeads?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navegação principal">
      {[...NAV, ...(showLeads ? [{ href: "/demonstracoes", label: "Pedidos de demonstração", icon: Inbox }] : [])].map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <item.icon size={18} aria-hidden="true" className={active ? "text-brand-light" : ""} />
            <span className="flex-1">{item.label}</span>
            {item.href === "/acoes" && openActions > 0 ? (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                {openActions}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 px-4 py-4">
      <p className="truncate text-sm font-semibold text-white">{userName}</p>
      <p className="truncate text-xs text-slate-400">
        {roleLabel} · {providerName}
      </p>
      <form action={logoutAction} className="mt-3">
        <button
          type="submit"
          className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300 hover:text-white"
        >
          <LogOut size={15} aria-hidden="true" /> Sair
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Barra superior (celular e tablet) */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        <Link href="/painel" aria-label="RETENZA — painel">
          <Logo light />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="rounded-lg p-2 text-white hover:bg-white/10"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>
      {open ? (
        <div className="fixed inset-x-0 top-[52px] bottom-0 z-20 flex flex-col overflow-y-auto bg-ink lg:hidden">
          {nav}
          {footer}
        </div>
      ) : null}

      {/* Barra lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-ink lg:flex">
        <div className="px-5 pt-6 pb-2">
          <Link href="/painel" aria-label="RETENZA — painel">
            <Logo light />
          </Link>
          <p className="mt-1.5 text-[11px] font-medium tracking-[0.12em] text-slate-400 uppercase">
            Inteligência de retenção
          </p>
        </div>
        {nav}
        {footer}
      </aside>
    </>
  );
}
