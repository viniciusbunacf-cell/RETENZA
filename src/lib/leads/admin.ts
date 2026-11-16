/**
 * E-mails com acesso à lista de pedidos de demonstração do site
 * (variável RETENZA_ADMIN_EMAILS, separados por vírgula).
 */
export function isPlatformAdmin(email: string): boolean {
  const list = (process.env.RETENZA_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}
