import Link from "next/link";
import { Activity, ListChecks, Search } from "lucide-react";
import { NetworkGraphic } from "@/components/brand";
import { Logo } from "@/components/ui";

const PILLARS = [
  { icon: Search, title: "Detectar", text: "Sinais combinados de risco em rede, atendimento e financeiro." },
  { icon: Activity, title: "Entender", text: "Fatores e evidências por trás de cada alerta, por cliente e por região." },
  { icon: ListChecks, title: "Reter", text: "Ações preventivas com responsável, prazo e resultado medido." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink px-12 py-10 lg:flex">
        <NetworkGraphic className="pointer-events-none absolute -top-6 -right-24 w-[440px] opacity-90" />
        <Link href="/" aria-label="RETENZA — página inicial" className="relative self-start">
          <Logo light />
        </Link>
        <div className="relative">
          <p className="text-sm font-medium tracking-[0.14em] text-brand-light uppercase">
            Inteligência operacional de retenção
          </p>
          <h1 className="mt-4 max-w-lg text-4xl leading-tight font-semibold text-white">
            Não espere o cliente cancelar.
          </h1>
          <p className="mt-4 max-w-md text-lg text-slate-300">
            Identifique o risco. Entenda o motivo. Aja antes da perda.
          </p>
          <ul className="mt-10 space-y-5">
            {PILLARS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-light">
                  <p.icon size={20} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-white">{p.title}</span>
                  <span className="block text-sm text-slate-400">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">
          O score apoia a decisão da equipe. Ele nunca bloqueia, penaliza ou contata clientes automaticamente.
        </p>
      </aside>
      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <Link href="/" aria-label="RETENZA — página inicial" className="mb-8 inline-block lg:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
