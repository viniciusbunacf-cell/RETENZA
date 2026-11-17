import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Dumbbell,
  Eye,
  FileSpreadsheet,
  GraduationCap,
  HeartPulse,
  Laptop,
  Lock,
  MapPinned,
  Package,
  Radar,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wifi,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SEGMENTS, type SegmentId } from "@/lib/segments";
import {
  DemoSection,
  DifferentialsSection,
  Eyebrow,
  FaqSection,
  Hero,
  PilotSection,
  PlansSection,
  ProblemSection,
  ResultsSection,
  SecuritySection,
  StepsSection,
} from "./sections";

export const metadata: Metadata = {
  title: { absolute: "RETENZA · Prevenção de cancelamento para empresas com clientes recorrentes" },
  description:
    "O RETENZA mostra quais clientes estão perto de cancelar, por quê e o que fazer antes da perda. Para academias, escolas, software, clínicas, assinaturas, serviços e provedores de internet.",
};

/** Cartões da seção de segmentos: sinais típicos de cada um. */
const SEGMENT_CARDS: { id: SegmentId; icon: LucideIcon; signals: string }[] = [
  { id: "provedor", icon: Wifi, signals: "Quedas de conexão, lentidão, chamados técnicos, falhas concentradas por bairro e CTO." },
  { id: "academia", icon: Dumbbell, signals: "Queda na frequência, aulas canceladas, equipamentos parados, lotação." },
  { id: "educacao", icon: GraduationCap, signals: "Faltas, troca de professor, atraso nas mensalidades, reclamações de turma." },
  { id: "software", icon: Laptop, signals: "Menos acessos, incidentes, chamados de suporte, pedidos de desconto na renovação." },
  { id: "saude", icon: HeartPulse, signals: "Consultas remarcadas, espera longa, pacientes que somem, notas baixas." },
  { id: "assinatura", icon: Package, signals: "Entregas atrasadas, produto com problema, pausas e pedidos de desconto." },
  { id: "servicos", icon: Wrench, signals: "Visitas canceladas, retrabalho, atraso de pagamento, contratos sem uso." },
];

export default function SitePage() {
  return (
    <>
      <Hero
        eyebrow="Retenção de clientes para qualquer empresa"
        title="Não espere o cliente cancelar."
        text="O RETENZA cruza uso do serviço, falhas, chamados, atrasos de pagamento e sinais de insatisfação para mostrar quais clientes estão perto de sair, por quê e o que a sua equipe deve fazer antes da perda."
        bullets={["Somente leitura no seu sistema", "Score explicável", "Funciona com planilha"]}
        signupHref="/cadastro"
        mock={{
          title: "Aluno 2291",
          meta: "Unidade Centro · Plano anual · cliente há 8 meses",
          score: 80,
          factors: [
            { points: 30, label: "Sem check-in há 23 dias (antes: 12 por mês)" },
            { points: 20, label: "Reclamação reaberta duas vezes" },
            { points: 20, label: "Nota 1 de 5 no último atendimento" },
            { points: 10, label: "Pedido de desconto há 6 dias" },
          ],
          action: { title: "Contato de reengajamento", owner: "Relacionamento · prazo de 24 horas" },
          cluster: (
            <>
              <span className="font-semibold">28 alunos da Unidade Centro</span> com o mesmo problema
            </>
          ),
          footnote: "Exemplo fictício de uma rede de academias.",
        }}
      />

      <ProblemSection
        text="Sozinho, cada sinal parece pequeno. Juntos, mostram um cliente indo embora. Na maioria das empresas o risco só aparece quando o pedido de cancelamento chega — ou quando o cliente simplesmente some."
        alertDay={15}
        events={[
          { day: 2, label: "Passa a usar menos" },
          { day: 8, label: "Abre um chamado" },
          { day: 12, label: "O problema se repete" },
          { day: 15, label: "Reclama da qualidade" },
          { day: 19, label: "Atrasa o pagamento" },
          { day: 24, label: "Nota 1 no atendimento" },
          { day: 30, label: "Pede o cancelamento", final: true },
        ]}
      />

      {/* Segmentos */}
      <section id="segmentos" className="scroll-mt-20 border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="max-w-2xl pt-20">
            <Eyebrow>Segmentos</Eyebrow>
            <h2 className="mt-3 text-3xl leading-tight font-bold tracking-tight text-balance text-text sm:text-4xl">
              Se o seu cliente paga todo mês, o RETENZA trabalha para ele ficar.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-text-soft">
              O motor de risco é o mesmo para todos. Ao criar a conta, você escolhe o segmento e a plataforma passa a
              falar a sua língua: aluno, paciente, conta, assinante, unidade, turma ou bairro.
            </p>
          </div>
          <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SEGMENT_CARDS.map((c) => {
              const seg = SEGMENTS[c.id];
              const isp = c.id === "provedor";
              return (
                <li key={c.id} className={`flex flex-col rounded-2xl border p-6 ${isp ? "border-brand/40 bg-brand-soft/40" : "border-line"}`}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <c.icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-text">{seg.name}</h3>
                  <p className="text-sm text-text-muted">{seg.examples}</p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-text-soft">{c.signals}</p>
                  <Link
                    href={isp ? "/provedores" : `/cadastro?segmento=${c.id}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-strong hover:underline"
                  >
                    {isp ? "Ver a versão para provedores" : "Criar conta"} <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
            <li className="flex flex-col rounded-2xl border border-dashed border-line-strong p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-page text-text-soft">
                <Sparkles size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-text">Outro segmento</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-text-soft">
                Assinatura, mensalidade, contrato ou recompra: se existe relação recorrente, existe risco de perda que
                dá para prever.
              </p>
              <a href="#demonstracao" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-strong hover:underline">
                Fale com a gente <ArrowRight size={14} aria-hidden="true" />
              </a>
            </li>
          </ul>
        </div>
      </section>

      <StepsSection
        steps={[
          {
            title: "Detectar",
            text: "Lê os dados que você já tem (clientes, uso do serviço, chamados, falhas e faturas) e combina sinais de uso, qualidade do serviço, atendimento, financeiro, insatisfação e tempo de relacionamento.",
          },
          {
            title: "Entender",
            text: "Cada score mostra os fatores e a evidência, como “sem uso há 23 dias; antes, 12 por mês”. Quando vários clientes da mesma unidade ou região têm o mesmo problema, o RETENZA aponta a causa comum.",
          },
          {
            title: "Reter",
            text: "Cada alerta vira uma ação com recomendação, responsável e prazo. A equipe registra o que fez e o RETENZA acompanha se o risco daqueles clientes caiu.",
          },
        ]}
      />

      <DifferentialsSection
        text="Muitas ferramentas mostram um número. O RETENZA liga o risco à causa e acompanha o que a equipe fez para resolver, para a empresa corrigir o problema e não apenas tentar convencer o cliente a ficar."
        comparison={[
          ["Mostra clientes em risco", "Explica os fatores de risco de cada cliente"],
          ["Exibe um score", "Mostra as evidências e o histórico por trás do score"],
          ["Gera alertas", "Cria planos de ação com responsável e prazo"],
          ["Trata cada reclamação isolada", "Agrupa clientes afetados pelo mesmo problema na unidade ou região"],
          ["Acompanha cancelamentos", "Acompanha a evolução do risco depois de cada ação"],
          ["Mostra indicadores", "Mede o efeito das ações de retenção"],
        ]}
        modules={[
          {
            icon: Radar,
            title: "Radar de risco",
            text: "Todos os clientes classificados em crítico, alto, moderado e baixo, com fatores, linha do tempo e ação recomendada.",
          },
          {
            icon: MapPinned,
            title: "Concentração de falhas",
            text: "Problemas agrupados por unidade, região ou carteira. Trinta reclamações viram uma causa operacional para a equipe certa resolver.",
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
        ]}
      />

      <ResultsSection />

      <SecuritySection
        title="Os dados dos seus clientes tratados com cuidado desde o primeiro dia."
        items={[
          { icon: Lock, title: "Somente leitura", text: "O RETENZA não altera contratos, não bloqueia clientes e não envia mensagens." },
          { icon: ShieldCheck, title: "Dados isolados", text: "Cada empresa tem seu ambiente separado. Ninguém de fora acessa a sua base." },
          { icon: FileSpreadsheet, title: "Só o necessário", text: "Sem CPF, endereço completo ou dados de pagamento. A localização fica no nível de unidade ou região." },
          { icon: Eye, title: "Score explicável", text: "Toda classificação mostra o motivo. A decisão é sempre da sua equipe, como pede a LGPD." },
          { icon: UserCheck, title: "Acesso por função", text: "Proprietário, gestor e atendente com permissões diferentes." },
          { icon: ScrollText, title: "Registro de atividades", text: "Importações, alterações de regras e ações ficam registradas." },
        ]}
        integration={{
          text: "Hoje os dados entram por planilha (CSV) exportada do seu sistema de gestão, CRM, plataforma de pagamentos ou da planilha que a equipe já usa. Conectores diretos são desenvolvidos conforme o sistema das empresas do piloto.",
          chips: ["Sistema de gestão", "CRM", "Plataforma de pagamentos", "Planilha CSV"],
        }}
      />

      <PlansSection unit="clientes ativos" geoFeature="Análise por unidade e região" />

      <PilotSection
        eyebrow="Programa de empresas parceiras"
        title="Estamos selecionando empresas para o piloto."
        who="a empresa"
      />

      <DemoSection />

      <FaqSection
        faq={[
          {
            q: "O RETENZA funciona para o meu segmento?",
            a: "Se os seus clientes têm relação recorrente (assinatura, mensalidade, contrato ou recompra), sim. O motor de risco é o mesmo; no cadastro você escolhe o segmento e a plataforma passa a usar os seus termos. Provedores de internet têm uma versão dedicada.",
          },
          {
            q: "Que dados eu preciso ter?",
            a: "Basta a base de clientes com os cancelamentos dos últimos meses. Uso do serviço (visitas, acessos, aulas), chamados, falhas e faturas enriquecem a análise: quanto mais fontes, mais precisa a leitura de risco.",
          },
          {
            q: "Preciso trocar meu sistema de gestão?",
            a: "Não. O RETENZA trabalha ao lado do sistema que você já usa. Hoje os dados entram por planilha exportada do seu sistema; os conectores diretos são desenvolvidos conforme o sistema das empresas do piloto.",
          },
          {
            q: "O RETENZA manda mensagens ou bloqueia meus clientes?",
            a: "Não. A plataforma só lê dados e orienta a equipe. Quem decide e executa cada ação é o seu time.",
          },
          {
            q: "O valor depende do número de usuários da equipe?",
            a: "Não. O plano é definido pelo número de clientes ativos monitorados. Você inclui quantos usuários precisar.",
          },
        ]}
      />
    </>
  );
}
