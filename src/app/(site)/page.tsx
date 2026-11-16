import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart3,
  Check,
  ClipboardList,
  Eye,
  FileSpreadsheet,
  Lock,
  Mail,
  MapPinned,
  MessageCircle,
  Radar,
  ScrollText,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { NetworkGraphic } from "@/components/brand";
import { getContactChannels } from "@/lib/leads/contact";
import { DemoForm } from "./demo-form";

export const metadata: Metadata = {
  title: { absolute: "RETENZA · Prevenção de cancelamento para provedores de internet" },
  description:
    "O RETENZA mostra quais assinantes do seu provedor estão perto de cancelar, por quê e o que fazer antes da perda. Score explicável, ações com responsável e prazo, resultado medido.",
};

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-xs font-semibold tracking-[0.14em] uppercase ${light ? "text-brand-light" : "text-brand"}`}>
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Abertura                                                            */
/* ------------------------------------------------------------------ */

const HERO_FACTORS = [
  { points: 25, label: "4 quedas de conexão nos últimos 30 dias" },
  { points: 20, label: "Reclamação reaberta duas vezes" },
  { points: 20, label: "Nota 1 de 5 no último atendimento" },
  { points: 10, label: "Pedido de desconto há 6 dias" },
];

function RiskCardMock() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:mx-0">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_24px_60px_-28px_rgba(20,27,38,0.35)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.1em] text-text-muted uppercase">Radar de risco</p>
            <p className="mt-1 font-display text-lg font-semibold text-text">Assinante 10482</p>
            <p className="text-sm text-text-soft">Centro · Fibra 400 Mega · cliente há 6 meses</p>
          </div>
          <div className="text-right">
            <p className="font-display text-4xl leading-none font-semibold text-text tabular-nums">85</p>
            <span className="mt-1.5 inline-flex rounded-full bg-critical-soft px-2.5 py-0.5 text-xs font-semibold text-critical-ink">
              Risco crítico
            </span>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-page" aria-hidden="true">
          <div className="h-full w-[85%] rounded-full bg-critical" />
        </div>
        <p className="mt-5 text-xs font-semibold tracking-[0.1em] text-text-muted uppercase">Por que este cliente</p>
        <ul className="mt-2 divide-y divide-line">
          {HERO_FACTORS.map((f) => (
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
          <p className="mt-0.5 text-sm font-medium text-text">Verificação técnica prioritária</p>
          <p className="text-xs text-text-soft">Equipe técnica · prazo de 24 horas</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-sm sm:absolute sm:-bottom-8 sm:-left-10 sm:mt-0 sm:max-w-[290px]">
        <MapPinned size={20} className="shrink-0 text-critical" aria-hidden="true" />
        <p className="text-sm text-text">
          <span className="font-semibold">35 clientes do Centro</span> com a mesma falha de conexão
        </p>
      </div>
      <p className="mt-3 text-center text-xs text-text-muted sm:mt-12 lg:text-left">Exemplo com dados fictícios.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Linha do tempo do problema                                          */
/* ------------------------------------------------------------------ */

const TIMELINE = [
  { day: 3, label: "Queda de conexão" },
  { day: 8, label: "Chamado técnico" },
  { day: 12, label: "Nova queda" },
  { day: 15, label: "Reclama da velocidade" },
  { day: 19, label: "Atrasa a fatura" },
  { day: 24, label: "Nota 1 no atendimento" },
  { day: 30, label: "Pede o cancelamento", final: true },
];

function ProblemTimeline() {
  return (
    <div className="mt-10">
      {/* Telas largas: linha horizontal */}
      <div className="relative hidden md:block">
        <div className="absolute top-[7px] right-0 left-0 h-0.5 bg-line" aria-hidden="true" />
        <ol className="relative grid grid-cols-7 gap-2">
          {TIMELINE.map((e) => (
            <li key={e.day} className="relative flex flex-col items-start">
              {e.day === 15 ? (
                <span className="absolute -top-11 -left-3 rounded-full bg-brand px-3 py-1 text-xs font-semibold whitespace-nowrap text-white">
                  O RETENZA avisa aqui
                  <span className="absolute top-full left-4 h-0 w-0 border-x-[6px] border-t-[7px] border-x-transparent border-t-brand" aria-hidden="true" />
                </span>
              ) : null}
              <span
                className={`h-4 w-4 rounded-full border-[3px] border-white ${e.final ? "bg-critical" : "bg-brand"} shadow-[0_0_0_1px_var(--color-line)] ${e.day === 15 ? "ring-4 ring-brand/25" : ""}`}
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
        {TIMELINE.map((e) => (
          <li key={e.day} className="relative">
            <span
              className={`absolute top-1 -left-[27px] h-3 w-3 rounded-full ${e.final ? "bg-critical" : "bg-brand"}`}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-text-muted tabular-nums">Dia {e.day}</span>
            <p className={`text-sm ${e.final ? "font-semibold text-critical-ink" : "text-text"}`}>
              {e.label}
              {e.day === 15 ? <span className="ml-2 font-semibold text-brand-strong">← o RETENZA avisa aqui</span> : null}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Conteúdo                                                            */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    title: "Detectar",
    text: "Lê os dados que você já tem no sistema de gestão (clientes, chamados, eventos de rede e faturas) e combina sinais de qualidade do serviço, atendimento, financeiro, insatisfação e tempo de relacionamento.",
  },
  {
    title: "Entender",
    text: "Cada score mostra os fatores e a evidência, como “4 quedas nos últimos 30 dias”. Quando vários clientes da mesma região têm a mesma falha, o RETENZA aponta a causa comum.",
  },
  {
    title: "Reter",
    text: "Cada alerta vira uma ação com recomendação, responsável e prazo. A equipe registra o que fez e o RETENZA acompanha se o risco daqueles clientes caiu.",
  },
];

const COMPARISON = [
  ["Mostra clientes em risco", "Explica os fatores de risco de cada cliente"],
  ["Exibe um score", "Mostra as evidências e o histórico por trás do score"],
  ["Gera alertas", "Cria planos de ação com responsável e prazo"],
  ["Trata cada reclamação isolada", "Agrupa clientes afetados pela mesma falha na região"],
  ["Acompanha cancelamentos", "Acompanha a evolução do risco depois de cada ação"],
  ["Mostra indicadores", "Mede o efeito das ações de retenção"],
];

const MODULES = [
  {
    icon: Radar,
    title: "Radar de risco",
    text: "Todos os assinantes classificados em crítico, alto, moderado e baixo, com fatores, linha do tempo e ação recomendada.",
  },
  {
    icon: MapPinned,
    title: "Inteligência geográfica",
    text: "Concentração de falhas por bairro e CTO. Trinta ocorrências viram um problema de rede para a equipe técnica resolver.",
  },
  {
    icon: ClipboardList,
    title: "Central de ações",
    text: "Ações preventivas com responsável, prazo e histórico. O gestor vê o que está pendente, atrasado e concluído.",
  },
  {
    icon: BarChart3,
    title: "Indicadores de retenção",
    text: "Churn voluntário e involuntário, receita em risco, taxa de intervenção, tempo de resolução e resultado das ações.",
  },
];

const SECURITY = [
  { icon: Lock, title: "Somente leitura", text: "O RETENZA não altera contratos, não bloqueia clientes e não envia mensagens." },
  { icon: ShieldCheck, title: "Dados isolados", text: "Cada provedor tem seu ambiente separado. Ninguém de fora acessa a sua base." },
  { icon: FileSpreadsheet, title: "Só o necessário", text: "Sem CPF, endereço completo ou dados de pagamento. A localização fica no nível de bairro e CTO." },
  { icon: Eye, title: "Score explicável", text: "Toda classificação mostra o motivo. A decisão é sempre da sua equipe, como pede a LGPD." },
  { icon: UserCheck, title: "Acesso por função", text: "Proprietário, gestor e atendente com permissões diferentes." },
  { icon: ScrollText, title: "Registro de atividades", text: "Importações, alterações de regras e ações ficam registradas." },
];

const PLANS = [
  {
    name: "Start",
    price: "297",
    limit: "Até 2.000 assinantes",
    features: ["Dashboard de retenção", "Radar de risco", "Importação de dados", "Central de ações"],
  },
  {
    name: "Pro",
    price: "597",
    limit: "Até 10.000 assinantes",
    highlight: true,
    features: ["Tudo do Start", "Histórico avançado", "Análise de causas", "Indicadores de equipe", "Relatórios de intervenção"],
  },
  {
    name: "Business",
    price: "997",
    limit: "Até 30.000 assinantes",
    features: ["Tudo do Pro", "Análise geográfica", "Múltiplas equipes", "Integrações prioritárias", "Relatórios executivos"],
  },
];

const FAQ = [
  {
    q: "Preciso trocar meu sistema de gestão?",
    a: "Não. O RETENZA trabalha ao lado do sistema que você já usa. Hoje os dados entram por planilha exportada do seu sistema; o conector direto é desenvolvido para o sistema dos provedores do piloto.",
  },
  {
    q: "O RETENZA manda mensagens ou bloqueia meus clientes?",
    a: "Não. A plataforma só lê dados e orienta a equipe. Quem decide e executa cada ação é o seu time.",
  },
  {
    q: "E se eu não tiver histórico de cancelamentos?",
    a: "O RETENZA já identifica clientes com sinais de problema. Com o histórico dos últimos 6 a 12 meses, dá para medir quanto o score acerta na sua base e ajustar as regras.",
  },
  {
    q: "O valor depende do número de usuários da equipe?",
    a: "Não. O plano é definido pelo número de assinantes monitorados. Você inclui quantos usuários precisar.",
  },
];

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export default function SitePage() {
  const contact = getContactChannels();

  return (
    <>
      {/* Abertura */}
      <section className="overflow-hidden bg-page">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-28">
          <div className="min-w-0">
            <Eyebrow>Para provedores de internet</Eyebrow>
            <h1 className="mt-4 text-4xl leading-[1.05] font-bold tracking-tight text-balance text-text sm:text-5xl lg:text-[56px]">
              Não espere o cliente cancelar.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-soft">
              O RETENZA cruza quedas de conexão, chamados, atrasos e sinais de insatisfação para mostrar quais
              assinantes estão perto de sair, por quê e o que a sua equipe deve fazer antes da perda.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#demonstracao" className="btn-primary px-5 py-3 text-base">
                Pedir demonstração <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a href="#como-funciona" className="btn-secondary px-5 py-3 text-base">
                Como funciona
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-soft">
              {["Somente leitura no seu sistema", "Score explicável", "Feito para provedores regionais"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check size={16} className="text-keep" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <RiskCardMock />
        </div>
      </section>

      {/* Problema */}
      <section id="problema" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <Eyebrow>O problema</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance text-text sm:text-4xl">
              O cancelamento começa semanas antes do pedido.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-text-soft">
              Sozinho, cada evento parece pequeno. Juntos, mostram um cliente indo embora. Na maioria dos provedores
              o risco só aparece quando o pedido de cancelamento chega ao atendimento.
            </p>
          </div>
          <div className="pt-8 md:pt-16">
            <ProblemTimeline />
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="scroll-mt-20 border-y border-line bg-page">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance text-text sm:text-4xl">
              Identifique o risco. Entenda o motivo. Aja antes da perda.
            </h2>
          </div>
          <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-line bg-white p-6">
                <span className="font-display text-sm font-semibold text-brand tabular-nums">0{i + 1}</span>
                <h3 className="mt-2 font-display text-xl font-semibold text-text">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-text-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Diferenciais */}
      <section id="diferenciais" className="scroll-mt-20 bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="min-w-0">
            <Eyebrow>Diferenciais</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance text-text sm:text-4xl">
              Prevenção operacional, não só previsão.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-text-soft">
              Muitas ferramentas mostram um número. O RETENZA liga o risco à causa e acompanha o que a equipe fez
              para resolver, para o provedor corrigir o problema e não apenas tentar convencer o cliente a ficar.
            </p>
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
                {COMPARISON.map(([common, ours]) => (
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
            {MODULES.map((m) => (
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

      {/* Resultado medido */}
      <section className="bg-sand">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.14em] text-text uppercase">Resultado medido</p>
            <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance text-text sm:text-4xl">
              Cliente que recebeu uma mensagem e não cancelou não é cliente recuperado.
            </h2>
          </div>
          <ul className="min-w-0 space-y-5 text-lg leading-relaxed text-text">
            <li className="flex gap-3">
              <Check size={22} className="mt-1 shrink-0 text-keep" aria-hidden="true" />
              Comparamos clientes que receberam ação com clientes na mesma situação que não receberam.
            </li>
            <li className="flex gap-3">
              <Check size={22} className="mt-1 shrink-0 text-keep" aria-hidden="true" />
              Separamos a receita observada da receita estimada, para o número não ser maior do que a realidade.
            </li>
            <li className="flex gap-3">
              <Check size={22} className="mt-1 shrink-0 text-keep" aria-hidden="true" />
              Conferimos o score contra os cancelamentos que realmente aconteceram na sua base.
            </li>
          </ul>
        </div>
      </section>

      {/* Segurança e integração */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <Eyebrow>Segurança e LGPD</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance text-text sm:text-4xl">
              Os dados dos seus assinantes tratados com cuidado desde o primeiro dia.
            </h2>
          </div>
          <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {SECURITY.map((s) => (
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
              <p className="mt-2 leading-relaxed text-text-soft">
                Hoje os dados entram por planilha exportada do seu sistema de gestão. Conectores diretos com HubSoft,
                IXC Provedor, SGP e MK Solutions estão no plano, começando pelo sistema dos provedores do piloto.
              </p>
            </div>
            <ul className="flex flex-wrap gap-2">
              {["HubSoft", "IXC Provedor", "SGP", "MK Solutions", "Planilha CSV"].map((e) => (
                <li key={e} className="rounded-full border border-line-strong bg-white px-3 py-1 text-sm font-medium text-text">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="scroll-mt-20 border-y border-line bg-page">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <Eyebrow>Planos</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance text-text sm:text-4xl">
              Preço pelo tamanho da base, sem cobrança por usuário.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-text-soft">
              Você paga pelos assinantes monitorados e inclui quantas pessoas da equipe precisar.
            </p>
          </div>
          <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
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
          <p className="mt-5 text-sm text-text-muted">Valores de lançamento. Para bases acima de 30.000 assinantes, fale com a gente.</p>
        </div>
      </section>

      {/* Piloto */}
      <section id="piloto" className="relative scroll-mt-20 overflow-hidden bg-ink text-white">
        <NetworkGraphic className="pointer-events-none absolute -right-28 -bottom-10 hidden w-[560px] opacity-70 lg:block" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <Eyebrow light>Programa de provedores parceiros</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
              Estamos selecionando provedores para o piloto.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-300">
              Um período definido, com contrato e regras de proteção de dados, para testar o RETENZA na sua base real
              e medir o resultado junto com a sua equipe.
            </p>
          </div>
          <div className="mt-10 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold text-white">O que o provedor recebe</h3>
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

      {/* Demonstração */}
      <section id="demonstracao" className="scroll-mt-20 bg-page">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.35fr]">
          <div className="min-w-0">
            <Eyebrow>Demonstração</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance text-text sm:text-4xl">
              Veja o RETENZA funcionando.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-text-soft">
              Mostramos a plataforma com dados de exemplo e conversamos sobre como ela funcionaria com a sua base.
              Respondemos pelo e-mail ou WhatsApp que você informar.
            </p>
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
            <DemoForm />
          </div>
        </div>
      </section>

      {/* Perguntas */}
      <section className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl leading-tight font-bold tracking-tight text-text">Perguntas frequentes</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
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
    </>
  );
}
