/**
 * Seções do site, compartilhadas entre a página geral (todas as empresas) e as
 * páginas de segmento (ex.: /provedores). O conteúdo vem por props.
 */
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Check, Mail, MapPinned, MessageCircle } from "lucide-react";
import { NetworkGraphic } from "@/components/brand";
import { getContactChannels } from "@/lib/leads/contact";
import type { SegmentId } from "@/lib/segments";
import { DemoForm } from "./demo-form";

export function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-xs font-semibold tracking-[0.14em] uppercase ${light ? "text-brand-light" : "text-brand"}`}>
      {children}
    </p>
  );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance text-text sm:text-4xl">{title}</h2>
      {text ? <p className="mt-4 text-lg leading-relaxed text-text-soft">{text}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Abertura                                                            */
/* ------------------------------------------------------------------ */

export interface RiskMock {
  title: string;
  meta: string;
  score: number;
  factors: { points: number; label: string }[];
  action: { title: string; owner: string };
  cluster: React.ReactNode;
  footnote: string;
}

export function RiskCardMock({ mock }: { mock: RiskMock }) {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_24px_60px_-28px_rgba(20,27,38,0.35)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.1em] text-text-muted uppercase">Radar de risco</p>
            <p className="mt-1 font-display text-lg font-semibold text-text">{mock.title}</p>
            <p className="text-sm text-text-soft">{mock.meta}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-4xl leading-none font-semibold text-text tabular-nums">{mock.score}</p>
            <span className="mt-1.5 inline-flex rounded-full bg-critical-soft px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-critical-ink">
              Risco crítico
            </span>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-page" aria-hidden="true">
          <div className="h-full rounded-full bg-critical" style={{ width: `${mock.score}%` }} />
        </div>
        <p className="mt-5 text-xs font-semibold tracking-[0.1em] text-text-muted uppercase">Por que este cliente</p>
        <ul className="mt-2 divide-y divide-line">
          {mock.factors.map((f) => (
            <li key={f.label} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-10 shrink-0 rounded-md bg-page py-0.5 text-center font-semibold text-text tabular-nums">
                +{f.points}
              </span>
              <span className="text-text">{f.label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-xl bg-brand-soft px-4 py-3">
          <p className="text-xs font-semibold tracking-[0.1em] text-brand-strong uppercase">Ação recomendada</p>
          <p className="mt-0.5 text-sm font-medium text-text">{mock.action.title}</p>
          <p className="text-xs text-text-soft">{mock.action.owner}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-sm sm:absolute sm:-bottom-8 sm:-left-10 sm:mt-0 sm:max-w-[300px]">
        <MapPinned size={20} className="shrink-0 text-critical" aria-hidden="true" />
        <p className="text-sm text-text">{mock.cluster}</p>
      </div>
      <p className="mt-3 text-center text-xs text-text-muted sm:mt-12 lg:text-left">{mock.footnote}</p>
    </div>
  );
}

export function Hero({
  eyebrow,
  title,
  text,
  bullets,
  signupHref,
  mock,
}: {
  eyebrow: string;
  title: string;
  text: string;
  bullets: string[];
  signupHref: string;
  mock: RiskMock;
}) {
  return (
    <section className="overflow-hidden bg-page">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-28">
        <div className="min-w-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-4 text-4xl leading-[1.05] font-bold tracking-tight text-balance text-text sm:text-5xl lg:text-[56px]">
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-soft">{text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#demonstracao" className="btn-primary px-5 py-3 text-base">
              Pedir demonstração <ArrowRight size={18} aria-hidden="true" />
            </a>
            <Link href={signupHref} className="btn-secondary px-5 py-3 text-base">
              Criar conta da empresa
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-soft">
            {bullets.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check size={16} className="text-keep" aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <RiskCardMock mock={mock} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Problema                                                            */
/* ------------------------------------------------------------------ */

export interface TimelineEvent {
  day: number;
  label: string;
  final?: boolean;
}

function ProblemTimeline({ events, alertDay }: { events: TimelineEvent[]; alertDay: number }) {
  return (
    <div className="mt-10">
      {/* Telas largas: linha horizontal */}
      <div className="relative hidden md:block">
        <div className="absolute top-[7px] right-0 left-0 h-0.5 bg-line" aria-hidden="true" />
        <ol className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${events.length}, minmax(0, 1fr))` }}>
          {events.map((e) => (
            <li key={e.day} className="relative flex flex-col items-start">
              {e.day === alertDay ? (
                <span className="absolute -top-11 -left-3 rounded-full bg-brand px-3 py-1 text-xs font-semibold whitespace-nowrap text-white">
                  O RETENZA avisa aqui
                  <span className="absolute top-full left-4 h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-brand" aria-hidden="true" />
                </span>
              ) : null}
              <span
                className={`h-4 w-4 rounded-full border-[3px] border-white ${e.final ? "bg-critical" : "bg-brand"} shadow-[0_0_0_1px_var(--color-line)] ${e.day === alertDay ? "ring-4 ring-brand/25" : ""}`}
                aria-hidden="true"
              />
              <span className="mt-3 text-xs font-semibold text-text-muted tabular-nums">Dia {e.day}</span>
              <span className={`mt-0.5 text-sm ${e.final ? "font-semibold text-critical-ink" : "text-text"}`}>{e.label}</span>
            </li>
          ))}
        </ol>
      </div>
      {/* Celular: linha vertical */}
      <ol className="space-y-4 border-l-2 border-line pl-5 md:hidden">
        {events.map((e) => (
          <li key={e.day} className="relative">
            <span
              className={`absolute top-1 -left-[27px] h-3 w-3 rounded-full ${e.final ? "bg-critical" : "bg-brand"}`}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-text-muted tabular-nums">Dia {e.day}</span>
            <p className={`text-sm ${e.final ? "font-semibold text-critical-ink" : "text-text"}`}>
              {e.label}
              {e.day === alertDay ? <span className="ml-2 font-semibold text-brand-strong">← o RETENZA avisa aqui</span> : null}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProblemSection({
  text,
  events,
  alertDay,
}: {
  text: string;
  events: TimelineEvent[];
  alertDay: number;
}) {
  return (
    <section id="problema" className="scroll-mt-20 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="O problema" title="O cancelamento começa semanas antes do pedido." text={text} />
        <div className="pt-8 md:pt-16">
          <ProblemTimeline events={events} alertDay={alertDay} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Como funciona e diferenciais                                        */
/* ------------------------------------------------------------------ */

export function StepsSection({ steps }: { steps: { title: string; text: string }[] }) {
  return (
    <section id="como-funciona" className="scroll-mt-20 border-y border-line bg-page">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="Como funciona" title="Identifique o risco. Entenda o motivo. Aja antes da perda." />
        <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl border border-line bg-white p-6">
              <span className="font-display text-sm font-semibold text-brand tabular-nums">0{i + 1}</span>
              <h3 className="mt-2 font-display text-xl font-semibold text-text">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-text-soft">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function DifferentialsSection({
  text,
  comparison,
  modules,
}: {
  text: string;
  comparison: [string, string][];
  modules: { icon: LucideIcon; title: string; text: string }[];
}) {
  return (
    <section id="diferenciais" className="scroll-mt-20 bg-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="min-w-0">
          <SectionTitle eyebrow="Diferenciais" title="Prevenção operacional, não só previsão." text={text} />
        </div>
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-page">
                <th scope="col" className="px-5 py-3 text-sm font-semibold text-text-soft">
                  Painel de churn comum
                </th>
                <th scope="col" className="px-5 py-3 text-sm font-semibold text-brand-strong">
                  RETENZA
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {comparison.map(([common, ours]) => (
                <tr key={common}>
                  <td className="px-5 py-3.5 text-text-soft">{common}</td>
                  <td className="px-5 py-3.5 font-medium text-text">
                    <span className="flex items-start gap-2">
                      <Check size={18} className="mt-0.5 shrink-0 text-keep" aria-hidden="true" />
                      {ours}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m) => (
            <li key={m.title} className="rounded-2xl border border-line p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <m.icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-text">{m.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-soft">{m.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ResultsSection() {
  return (
    <section className="bg-sand">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.14em] text-text uppercase">Resultado medido</p>
          <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance text-text sm:text-4xl">
            Cliente que recebeu uma mensagem e não cancelou não é cliente recuperado.
          </h2>
        </div>
        <ul className="min-w-0 space-y-5 text-lg leading-relaxed text-text">
          {[
            "Comparamos clientes que receberam ação com clientes na mesma situação que não receberam.",
            "Separamos a receita observada da receita estimada, para o número não ser maior do que a realidade.",
            "Conferimos o score contra os cancelamentos que realmente aconteceram na sua base.",
          ].map((t) => (
            <li key={t} className="flex gap-3">
              <Check size={22} className="mt-1 shrink-0 text-keep" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Segurança, planos e piloto                                          */
/* ------------------------------------------------------------------ */

export function SecuritySection({
  title,
  items,
  integration,
}: {
  title: string;
  items: { icon: LucideIcon; title: string; text: string }[];
  integration: { text: string; chips: string[] };
}) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="Segurança e LGPD" title={title} />
        <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <li key={s.title} className="flex gap-4">
              <s.icon size={22} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
              <div>
                <h3 className="font-semibold text-text">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-text-soft">{s.text}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-14 flex flex-col gap-6 rounded-2xl border border-line bg-page p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h3 className="font-display text-xl font-semibold text-text">Conecta ao que você já usa</h3>
            <p className="mt-2 leading-relaxed text-text-soft">{integration.text}</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {integration.chips.map((e) => (
              <li key={e} className="rounded-full border border-line-strong bg-white px-3 py-1 text-sm font-medium text-text">
                {e}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function PlansSection({ unit, geoFeature }: { unit: string; geoFeature: string }) {
  const plans = [
    {
      name: "Start",
      price: "297",
      limit: `Até 2.000 ${unit}`,
      features: ["Dashboard de retenção", "Radar de risco", "Importação de dados", "Central de ações"],
    },
    {
      name: "Pro",
      price: "597",
      limit: `Até 10.000 ${unit}`,
      highlight: true,
      features: ["Tudo do Start", "Histórico avançado", "Análise de causas", "Indicadores de equipe", "Relatórios de intervenção"],
    },
    {
      name: "Business",
      price: "997",
      limit: `Até 30.000 ${unit}`,
      features: ["Tudo do Pro", geoFeature, "Múltiplas equipes", "Integrações prioritárias", "Relatórios executivos"],
    },
  ];
  return (
    <section id="planos" className="scroll-mt-20 border-y border-line bg-page">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionTitle
          eyebrow="Planos"
          title="Preço pelo tamanho da base, sem cobrança por usuário."
          text={`Você paga pelos ${unit} monitorados e inclui quantas pessoas da equipe precisar.`}
        />
        <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((p) => (
            <li
              key={p.name}
              className={`flex flex-col rounded-2xl border bg-white p-6 sm:p-7 ${p.highlight ? "border-brand ring-1 ring-brand" : "border-line"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-xl font-semibold text-text">{p.name}</h3>
                {p.highlight ? (
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-strong">
                    Plano principal
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-text-soft">{p.limit}</p>
              <p className="mt-5 flex items-baseline gap-1 text-text">
                <span className="text-sm font-medium">R$</span>
                <span className="font-display text-4xl font-bold tracking-tight tabular-nums">{p.price}</span>
                <span className="text-sm text-text-soft">/mês</span>
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm text-text">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={16} className="mt-0.5 shrink-0 text-keep" aria-hidden="true" /> {f}
                  </li>
                ))}
              </ul>
              <a href="#demonstracao" className={`mt-7 ${p.highlight ? "btn-primary" : "btn-secondary"}`}>
                Pedir demonstração
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-text-muted">Valores de lançamento. Para bases acima de 30.000 {unit}, fale com a gente.</p>
      </div>
    </section>
  );
}

export function PilotSection({ eyebrow, title, who }: { eyebrow: string; title: string; who: string }) {
  return (
    <section id="piloto" className="relative scroll-mt-20 overflow-hidden bg-ink text-white">
      <NetworkGraphic className="pointer-events-none absolute -right-28 -bottom-10 hidden w-[560px] opacity-70 lg:block" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow light>{eyebrow}</Eyebrow>
          <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">
            Um período definido, com contrato e regras de proteção de dados, para testar o RETENZA na sua base real e
            medir o resultado junto com a sua equipe.
          </p>
        </div>
        <div className="mt-10 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <h3 className="font-semibold text-white">O que {who} recebe</h3>
            <ul className="mt-3 space-y-2 text-slate-300">
              {[
                "Implantação acompanhada",
                "Análise inicial da carteira",
                "Monitoramento dos clientes em risco",
                "Relatórios semanais e reuniões de acompanhamento",
                "Conector para o seu sistema de gestão",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <Check size={18} className="mt-0.5 shrink-0 text-[#3CCB8B]" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-white">O que pedimos</h3>
            <ul className="mt-3 space-y-2 text-slate-300">
              {[
                "Acesso de leitura aos dados necessários",
                "Histórico de cancelamentos dos últimos 6 a 12 meses",
                "Participação da equipe nas ações preventivas",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <ArrowRight size={18} className="mt-0.5 shrink-0 text-brand-light" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <a href="#demonstracao" className="btn-primary mt-10 px-5 py-3 text-base">
          Quero participar do piloto <ArrowRight size={18} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Demonstração e perguntas                                            */
/* ------------------------------------------------------------------ */

export function DemoSection({ defaultSegment }: { defaultSegment?: SegmentId }) {
  const contact = getContactChannels();
  return (
    <section id="demonstracao" className="scroll-mt-20 bg-page">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.35fr]">
        <div className="min-w-0">
          <SectionTitle
            eyebrow="Demonstração"
            title="Veja o RETENZA funcionando."
            text="Mostramos a plataforma com dados de exemplo e conversamos sobre como ela funcionaria com a sua base. Respondemos pelo e-mail ou WhatsApp que você informar."
          />
          {contact.email || contact.whatsapp ? (
            <div className="mt-8 space-y-3">
              <p className="text-sm font-semibold text-text">Prefere falar direto?</p>
              {contact.whatsapp ? (
                <a
                  href={`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent("Olá! Quero conhecer o RETENZA.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 hover:border-line-strong"
                >
                  <MessageCircle size={20} className="shrink-0 text-keep" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text">WhatsApp</span>
                    <span className="block text-sm text-text-soft">{contact.whatsappDisplay}</span>
                  </span>
                </a>
              ) : null}
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}?subject=${encodeURIComponent("Demonstração do RETENZA")}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 hover:border-line-strong"
                >
                  <Mail size={20} className="shrink-0 text-brand" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text">E-mail</span>
                    <span className="block truncate text-sm text-text-soft">{contact.email}</span>
                  </span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="relative min-w-0">
          <DemoForm defaultSegment={defaultSegment} />
        </div>
      </div>
    </section>
  );
}

export function FaqSection({ faq }: { faq: { q: string; a: string }[] }) {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl leading-tight font-bold tracking-tight text-text">Perguntas frequentes</h2>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {faq.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-text">
                {f.q}
                <span className="text-xl leading-none text-text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-text-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
