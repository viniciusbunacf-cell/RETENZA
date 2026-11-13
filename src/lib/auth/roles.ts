export type Role = "owner" | "manager" | "agent";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Proprietário",
  manager: "Gestor",
  agent: "Atendente",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Acesso total: usuários, regras de risco, importações e ações.",
  manager: "Gerencia regras de risco, importações e ações da equipe.",
  agent: "Consulta clientes em risco e executa as ações preventivas.",
};

/** Quem pode alterar regras, importar dados e recalcular o risco. */
export function canManage(role: Role): boolean {
  return role === "owner" || role === "manager";
}

/** Quem pode gerenciar usuários. */
export function canAdminister(role: Role): boolean {
  return role === "owner";
}
