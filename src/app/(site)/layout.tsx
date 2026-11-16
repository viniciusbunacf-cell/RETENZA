import Link from "next/link";
import { Logo } from "@/components/brand";
import { getSessionUser } from "@/lib/auth/session";
import { getContactChannels } from "@/lib/leads/contact";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#diferenciais", label: "Diferenciais" },
  { href: "/#planos", label: "Planos" },
  { href: "/#piloto", label: "Piloto" },
];

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const contact = getContactChannels();
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="RETENZA — página inicial" className="shrink-0">
            <Logo />
          </Link>
          <nav aria-label="Seções do site" className="hidden items-center gap-7 text-sm font-medium text-text-soft md:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-text">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href={user ? "/painel" : "/login"} className="btn-ghost px-3">
              {user ? "Abrir painel" : "Entrar"}
            </Link>
            <Link href="/#demonstracao" className="btn-primary px-3 sm:px-3.5">
              <span className="sm:hidden">Demonstração</span>
              <span className="hidden sm:inline">Pedir demonstração</span>
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="bg-ink text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-3 max-w-xs text-sm text-slate-400">
              Inteligência operacional de retenção para provedores de internet.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-slate-400 uppercase">Plataforma</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/#como-funciona" className="hover:text-white">
                  Como funciona
                </Link>
              </li>
              <li>
                <Link href="/#planos" className="hover:text-white">
                  Planos
                </Link>
              </li>
              <li>
                <Link href={user ? "/painel" : "/login"} className="hover:text-white">
                  {user ? "Abrir painel" : "Entrar"}
                </Link>
              </li>
              <li>
                <Link href="/privacidade" className="hover:text-white">
                  Privacidade
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-slate-400 uppercase">Contato</p>
            <ul className="mt-3 space-y-2 text-sm">
              {contact.email ? (
                <li>
                  <a href={`mailto:${contact.email}`} className="break-all hover:text-white">
                    {contact.email}
                  </a>
                </li>
              ) : null}
              {contact.whatsapp ? (
                <li>
                  <a href={`https://wa.me/${contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                    WhatsApp {contact.whatsappDisplay}
                  </a>
                </li>
              ) : null}
              <li>
                <Link href="/#demonstracao" className="hover:text-white">
                  Pedir demonstração
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-slate-500 sm:px-6">© {year} RETENZA</p>
        </div>
      </footer>
    </div>
  );
}
