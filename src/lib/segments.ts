/**
 * Segmentos atendidos pelo RETENZA. O motor de risco é o mesmo para todos;
 * o segmento muda os termos da interface e o texto das recomendações.
 */

export type SegmentId = "provedor" | "academia" | "educacao" | "software" | "saude" | "assinatura" | "servicos" | "outro";

export interface SegmentTerms {
  id: SegmentId;
  /** Nome do segmento, como aparece no cadastro e no site. */
  name: string;
  /** Exemplos curtos para o cadastro e o site. */
  examples: string;
  customer: string;
  customers: string;
  /** "o assinante" / "o aluno": artigo + termo, para frases. */
  theCustomer: string;
  /** Agrupamento geográfico ou operacional (coluna "região"). */
  region: string;
  regions: string;
  /** Subdivisão dentro da região (coluna "subunidade"). */
  unit: string;
  /** Como chamar as falhas registradas no serviço. */
  incidents: string;
  incidentTypes: { outage: string; instability: string; slow_speed: string };
  /** Como chamar o uso registrado (visitas, aulas, acessos...). */
  usage: string;
  /** Equipe que resolve falhas no serviço. */
  serviceTeam: string;
  /** Recomendação para falhas no serviço de um cliente. */
  serviceAction: string;
  /** Recomendação para falhas concentradas numa região. */
  regionAction: string;
  /** Sistemas de gestão comuns no segmento (sugestões no cadastro). */
  systems: string[];
  /** Exemplo de plano, para modelos e textos. */
  planExample: string;
}

const base = {
  incidentTypes: { outage: "Interrupção do serviço", instability: "Problema recorrente", slow_speed: "Qualidade abaixo do esperado" },
  serviceTeam: "Operações",
  serviceAction:
    "Verificar o histórico de falhas do cliente, corrigir a causa e avisar o cliente sobre o que foi encontrado e resolvido.",
  regionAction:
    "Verificar o que a região tem em comum (equipe, unidade, fornecedor ou processo) e tratar a causa antes de abordar os clientes um a um. Depois da correção, avisar os clientes afetados e acompanhar se o risco diminui.",
};

export const SEGMENTS: Record<SegmentId, SegmentTerms> = {
  provedor: {
    id: "provedor",
    name: "Provedores de internet",
    examples: "Fibra, rádio e TV por assinatura",
    customer: "assinante",
    customers: "assinantes",
    theCustomer: "o assinante",
    region: "bairro",
    regions: "bairros",
    unit: "CTO",
    incidents: "eventos de rede",
    incidentTypes: { outage: "Queda de conexão", instability: "Instabilidade", slow_speed: "Lentidão medida" },
    usage: "tráfego",
    serviceTeam: "Equipe técnica",
    serviceAction:
      "Analisar o sinal e o histórico de quedas do cliente, agendar visita técnica se necessário e avisar o cliente sobre o que foi encontrado e corrigido.",
    regionAction:
      "Verificar a infraestrutura que atende a região (CTO, rota óptica, equipamentos) e tratar a causa comum antes de abordar clientes individualmente. Depois da correção, avisar os clientes afetados e acompanhar se o risco diminui.",
    systems: ["HubSoft", "IXC Provedor", "SGP", "MK Solutions"],
    planExample: "Fibra 400 Mega",
  },
  academia: {
    id: "academia",
    name: "Academias e estúdios",
    examples: "Musculação, crossfit, pilates, natação",
    customer: "aluno",
    customers: "alunos",
    theCustomer: "o aluno",
    region: "unidade",
    regions: "unidades",
    unit: "modalidade",
    incidents: "problemas na unidade",
    incidentTypes: { outage: "Aula cancelada ou unidade fechada", instability: "Equipamento parado", slow_speed: "Lotação ou espera" },
    usage: "frequência",
    serviceTeam: "Gestão da unidade",
    serviceAction:
      "Verificar o que afetou o aluno (aula cancelada, equipamento parado, lotação), resolver a causa e avisar o aluno sobre a solução.",
    regionAction: base.regionAction,
    systems: ["EVO", "Tecnofit", "Next Fit", "Pacto"],
    planExample: "Plano anual",
  },
  educacao: {
    id: "educacao",
    name: "Escolas e cursos",
    examples: "Idiomas, cursos livres, ensino a distância",
    customer: "aluno",
    customers: "alunos",
    theCustomer: "o aluno",
    region: "unidade",
    regions: "unidades",
    unit: "turma",
    incidents: "problemas nas aulas",
    incidentTypes: { outage: "Aula cancelada", instability: "Troca de professor ou horário", slow_speed: "Atraso de material ou acesso" },
    usage: "presença",
    serviceTeam: "Coordenação",
    serviceAction:
      "Verificar o que afetou o aluno (aulas canceladas, trocas de turma, falta de material), resolver com a coordenação e retornar ao aluno ou responsável.",
    regionAction: base.regionAction,
    systems: ["Sponte", "Gennera", "Hotmart", "Moodle"],
    planExample: "Curso semestral",
  },
  software: {
    id: "software",
    name: "Software e apps por assinatura",
    examples: "SaaS, aplicativos, plataformas digitais",
    customer: "conta",
    customers: "contas",
    theCustomer: "a conta",
    region: "segmento",
    regions: "segmentos",
    unit: "carteira",
    incidents: "incidentes",
    incidentTypes: { outage: "Indisponibilidade", instability: "Erro recorrente", slow_speed: "Lentidão" },
    usage: "acessos",
    serviceTeam: "Suporte técnico",
    serviceAction:
      "Verificar os incidentes que afetaram a conta, corrigir ou contornar o problema e retornar ao cliente com o que foi feito.",
    regionAction:
      "Verificar o que as contas afetadas têm em comum (versão, integração, plano) e corrigir a causa antes de abordar cada conta. Depois, avisar os clientes e acompanhar se o risco diminui.",
    systems: ["Stripe", "Vindi", "Iugu", "HubSpot"],
    planExample: "Plano Pro",
  },
  saude: {
    id: "saude",
    name: "Clínicas e planos de saúde",
    examples: "Clínicas, odontologia, planos e cartões de saúde",
    customer: "paciente",
    customers: "pacientes",
    theCustomer: "o paciente",
    region: "unidade",
    regions: "unidades",
    unit: "especialidade",
    incidents: "problemas de atendimento",
    incidentTypes: { outage: "Consulta cancelada", instability: "Remarcação recorrente", slow_speed: "Espera acima do esperado" },
    usage: "consultas",
    serviceTeam: "Coordenação da unidade",
    serviceAction:
      "Verificar o que afetou o paciente (cancelamentos, remarcações, espera), resolver a causa com a unidade e retornar ao paciente.",
    regionAction: base.regionAction,
    systems: ["iClinic", "Feegow", "Clinicorp", "Amplimed"],
    planExample: "Plano familiar",
  },
  assinatura: {
    id: "assinatura",
    name: "Clubes e serviços por assinatura",
    examples: "Clubes de assinatura, entregas recorrentes, streaming",
    customer: "assinante",
    customers: "assinantes",
    theCustomer: "o assinante",
    region: "região",
    regions: "regiões",
    unit: "rota",
    incidents: "problemas de entrega ou serviço",
    incidentTypes: { outage: "Entrega não realizada", instability: "Atraso recorrente", slow_speed: "Produto ou serviço com problema" },
    usage: "uso",
    serviceTeam: "Operações",
    serviceAction:
      "Verificar as falhas de entrega ou de serviço do assinante, corrigir com a operação e avisar o assinante sobre a solução.",
    regionAction: base.regionAction,
    systems: ["Vindi", "Assinaturas Shopify", "Pagar.me", "Planilha"],
    planExample: "Assinatura mensal",
  },
  servicos: {
    id: "servicos",
    name: "Serviços recorrentes para empresas",
    examples: "Contabilidade, segurança, manutenção, facilities",
    customer: "cliente",
    customers: "clientes",
    theCustomer: "o cliente",
    region: "região",
    regions: "regiões",
    unit: "carteira",
    incidents: "falhas no serviço",
    incidentTypes: base.incidentTypes,
    usage: "uso",
    serviceTeam: base.serviceTeam,
    serviceAction: base.serviceAction,
    regionAction: base.regionAction,
    systems: ["Omie", "Conta Azul", "Bling", "Planilha"],
    planExample: "Contrato mensal",
  },
  outro: {
    id: "outro",
    name: "Outro segmento",
    examples: "Qualquer empresa com clientes recorrentes",
    customer: "cliente",
    customers: "clientes",
    theCustomer: "o cliente",
    region: "região",
    regions: "regiões",
    unit: "unidade",
    incidents: "falhas no serviço",
    incidentTypes: base.incidentTypes,
    usage: "uso",
    serviceTeam: base.serviceTeam,
    serviceAction: base.serviceAction,
    regionAction: base.regionAction,
    systems: ["Planilha"],
    planExample: "Plano mensal",
  },
};

export const SEGMENT_ORDER: SegmentId[] = ["provedor", "academia", "educacao", "software", "saude", "assinatura", "servicos", "outro"];

export function segmentOf(id: string | null | undefined): SegmentTerms {
  return SEGMENTS[(id ?? "") as SegmentId] ?? SEGMENTS.outro;
}

export function isSegmentId(id: string): id is SegmentId {
  return Object.hasOwn(SEGMENTS, id);
}

/** Primeira letra maiúscula, para títulos e rótulos. */
export function cap(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
