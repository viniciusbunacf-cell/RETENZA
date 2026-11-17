import type { Metadata } from "next";
import { BarChart3, ClipboardList, Eye, FileSpreadsheet, Lock, MapPinned, Radar, ScrollText, ShieldCheck, UserCheck } from "lucide-react";
import {
  DemoSection,
  DifferentialsSection,
  FaqSection,
  Hero,
  PilotSection,
  PlansSection,
  ProblemSection,
  ResultsSection,
  SecuritySection,
  StepsSection,
} from "../sections";

export const metadata: Metadata = {
  title: { absolute: "RETENZA para provedores de internet · Prevenção de cancelamento" },
  description:
    "O RETENZA mostra quais assinantes do seu provedor estão perto de cancelar, por quê e o que fazer antes da perda. Score explicável, ações com responsável e prazo, resultado medido.",
};

export default function ProvidersPage() {
  return (
    <>
      <Hero
        eyebrow="RETENZA para provedores de internet"
        title="Não espere o assinante cancelar."
        text="O RETENZA cruza quedas de conexão, chamados, atrasos e sinais de insatisfação para mostrar quais assinantes estão perto de sair, por quê e o que a sua equipe deve fazer antes da perda."
        bullets={["Somente leitura no seu sistema", "Score explicável", "Feito para provedores regionais"]}
        signupHref="/cadastro?segmento=provedor"
        mock={{
          title: "Assinante 10482",
          meta: "Centro · Fibra 400 Mega · cliente há 6 meses",
          score: 85,
          factors: [
            { points: 25, label: "4 quedas de conexão nos últimos 30 dias" },
            { points: 20, label: "Reclamação reaberta duas vezes" },
            { points: 20, label: "Nota 1 de 5 no último atendimento" },
            { points: 10, label: "Pedido de desconto há 6 dias" },
          ],
          action: { title: "Verificação técnica prioritária", owner: "Equipe técnica · prazo de 24 horas" },
          cluster: (
            <>
              <span className="font-semibold">35 clientes do Centro</span> com a mesma falha de conexão
            </>
          ),
          footnote: "Exemplo com dados fictícios.",
        }}
      />

      <ProblemSection
        text="Sozinho, cada evento parece pequeno. Juntos, mostram um cliente indo embora. Na maioria dos provedores o risco só aparece quando o pedido de cancelamento chega ao atendimento."
        alertDay={15}
        events={[
          { day: 3, label: "Queda de conexão" },
          { day: 8, label: "Chamado técnico" },
          { day: 12, label: "Nova queda" },
          { day: 15, label: "Reclama da velocidade" },
          { day: 19, label: "Atrasa a fatura" },
          { day: 24, label: "Nota 1 no atendimento" },
          { day: 30, label: "Pede o cancelamento", final: true },
        ]}
      />

      <StepsSection
        steps={[
          {
            title: "Detectar",
            text: "Lê os dados que você já tem no sistema de gestão (clientes, chamados, eventos de rede e faturas) e combina sinais de qualidade do serviço, atendimento, financeiro, insatisfação e tempo de relacionamento.",
          },
          {
            title: "Entender",
            text: "Cada score mostra os fatores e a evidência, como “4 quedas nos últimos 30 dias”. Quando vários clientes do mesmo bairro ou CTO têm a mesma falha, o RETENZA aponta a causa comum.",
          },
          {
            title: "Reter",
            text: "Cada alerta vira uma ação com recomendação, responsável e prazo. A equipe registra o que fez e o RETENZA acompanha se o risco daqueles clientes caiu.",
          },
        ]}
      />

      <DifferentialsSection
        text="Muitas ferramentas mostram um número. O RETENZA liga o risco à causa e acompanha o que a equipe fez para resolver, para o provedor corrigir o problema e não apenas tentar convencer o cliente a ficar."
        comparison={[
          ["Mostra clientes em risco", "Explica os fatores de risco de cada cliente"],
          ["Exibe um score", "Mostra as evidências e o histórico por trás do score"],
          ["Gera alertas", "Cria planos de ação com responsável e prazo"],
          ["Trata cada reclamação isolada", "Agrupa clientes afetados pela mesma falha no bairro ou CTO"],
          ["Acompanha cancelamentos", "Acompanha a evolução do risco depois de cada ação"],
          ["Mostra indicadores", "Mede o efeito das ações de retenção"],
        ]}
        modules={[
          {
            icon: Radar,
            title: "Radar de risco",
            text: "Todos os assinantes classificados em crítico, alto, moderado e baixo, com fatores, linha do tempo e ação recomendada.",
          },
          {
            icon: MapPinned,
            title: "Concentração de falhas",
            text: "Falhas agrupadas por bairro e CTO. Trinta ocorrências viram um problema de rede para a equipe técnica resolver.",
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
        title="Os dados dos seus assinantes tratados com cuidado desde o primeiro dia."
        items={[
          { icon: Lock, title: "Somente leitura", text: "O RETENZA não altera contratos, não bloqueia clientes e não envia mensagens." },
          { icon: ShieldCheck, title: "Dados isolados", text: "Cada provedor tem seu ambiente separado. Ninguém de fora acessa a sua base." },
          { icon: FileSpreadsheet, title: "Só o necessário", text: "Sem CPF, endereço completo ou dados de pagamento. A localização fica no nível de bairro e CTO." },
          { icon: Eye, title: "Score explicável", text: "Toda classificação mostra o motivo. A decisão é sempre da sua equipe, como pede a LGPD." },
          { icon: UserCheck, title: "Acesso por função", text: "Proprietário, gestor e atendente com permissões diferentes." },
          { icon: ScrollText, title: "Registro de atividades", text: "Importações, alterações de regras e ações ficam registradas." },
        ]}
        integration={{
          text: "Hoje os dados entram por planilha exportada do seu sistema de gestão. Conectores diretos com HubSoft, IXC Provedor, SGP e MK Solutions estão no plano, começando pelo sistema dos provedores do piloto.",
          chips: ["HubSoft", "IXC Provedor", "SGP", "MK Solutions", "Planilha CSV"],
        }}
      />

      <PlansSection unit="assinantes" geoFeature="Análise por bairro e CTO" />

      <PilotSection
        eyebrow="Programa de provedores parceiros"
        title="Estamos selecionando provedores para o piloto."
        who="o provedor"
      />

      <DemoSection defaultSegment="provedor" />

      <FaqSection
        faq={[
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
        ]}
      />
    </>
  );
}
