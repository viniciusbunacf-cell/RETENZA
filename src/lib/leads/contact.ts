/**
 * Canais comerciais do RETENZA, definidos por variáveis de ambiente:
 *  - RETENZA_CONTATO_EMAIL: e-mail que recebe os pedidos de demonstração;
 *  - RETENZA_CONTATO_WHATSAPP: número de WhatsApp com DDI e DDD (ex.: 5511912345678).
 * Sem essas variáveis o site esconde o canal correspondente; o formulário
 * continua gravando os pedidos no banco.
 */

import { isSegmentId, SEGMENTS } from "@/lib/segments";

export interface DemoLead {
  name: string;
  role?: string | null;
  company: string;
  /** Id do segmento (src/lib/segments.ts). */
  segment?: string | null;
  city?: string | null;
  subscribers?: string | null;
  erp?: string | null;
  email: string;
  whatsapp: string;
  message?: string | null;
}

export interface ContactChannels {
  email: string | null;
  whatsapp: string | null;
  whatsappDisplay: string | null;
}

/** Mantém só os dígitos e acrescenta o DDI 55 a números brasileiros sem DDI. */
export function normalizeWhatsapp(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  if (digits.length >= 12 && digits.length <= 13 && digits.startsWith("55")) return digits;
  return null;
}

/** "5511912345678" → "+55 (11) 91234-5678". */
export function formatWhatsapp(digits: string): string {
  if (!digits.startsWith("55") || (digits.length !== 12 && digits.length !== 13)) return "+" + digits;
  const ddd = digits.slice(2, 4);
  const number = digits.slice(4);
  const split = number.length - 4;
  return `+55 (${ddd}) ${number.slice(0, split)}-${number.slice(split)}`;
}

export function getContactChannels(): ContactChannels {
  const email = (process.env.RETENZA_CONTATO_EMAIL ?? "").trim();
  const whatsapp = normalizeWhatsapp(process.env.RETENZA_CONTATO_WHATSAPP);
  return {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    whatsapp,
    whatsappDisplay: whatsapp ? formatWhatsapp(whatsapp) : null,
  };
}

export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

const line = (label: string, value: string | null | undefined) => (value ? `${label}: ${value}` : null);

function leadLines(lead: DemoLead): string[] {
  return [
    line("Nome", lead.name),
    line("Cargo", lead.role),
    line("Empresa", lead.company),
    line("Segmento", lead.segment && isSegmentId(lead.segment) ? SEGMENTS[lead.segment].name : lead.segment),
    line("Cidade", lead.city),
    line("Clientes ativos", lead.subscribers),
    line("Sistema de gestão", lead.erp),
    line("E-mail", lead.email),
    line("WhatsApp", lead.whatsapp),
    line("Mensagem", lead.message),
  ].filter((l): l is string => l !== null);
}

/** Mensagem pré-preenchida que o visitante envia ao WhatsApp comercial. */
export function buildWhatsappMessage(lead: DemoLead): string {
  return ["Olá! Acabei de pedir uma demonstração do RETENZA pelo site.", "", ...leadLines(lead)].join("\n");
}

export function buildLeadEmail(lead: DemoLead): { subject: string; text: string; html: string } {
  const lines = leadLines(lead);
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rows = lines
    .map((l) => {
      const i = l.indexOf(": ");
      return `<tr><td style="padding:4px 12px 4px 0;color:#4A5567;vertical-align:top">${escape(l.slice(0, i))}</td><td style="padding:4px 0;color:#141B26">${escape(l.slice(i + 2)).replace(/\n/g, "<br>")}</td></tr>`;
    })
    .join("");
  return {
    subject: `Pedido de demonstração: ${lead.company}`,
    text: ["Novo pedido de demonstração pelo site do RETENZA.", "", ...lines].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;font-size:14px"><p style="color:#141B26">Novo pedido de demonstração pelo site do RETENZA.</p><table style="border-collapse:collapse">${rows}</table></div>`,
  };
}

export type EmailStatus = "sent" | "not_configured" | "failed";

/**
 * Envia o aviso de novo pedido pelo serviço Resend (https://resend.com).
 * Requer RESEND_API_KEY e RETENZA_CONTATO_EMAIL. O remetente pode ser
 * definido em RETENZA_EMAIL_REMETENTE (domínio verificado no Resend).
 */
export async function sendLeadEmail(lead: DemoLead): Promise<EmailStatus> {
  const apiKey = process.env.RESEND_API_KEY;
  const { email } = getContactChannels();
  if (!apiKey || !email) return "not_configured";
  const from = process.env.RETENZA_EMAIL_REMETENTE || "RETENZA <onboarding@resend.dev>";
  const content = buildLeadEmail(lead);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], reply_to: lead.email, ...content }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Falha ao enviar e-mail de pedido de demonstração:", response.status, await response.text());
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error("Falha ao enviar e-mail de pedido de demonstração:", err);
    return "failed";
  }
}
