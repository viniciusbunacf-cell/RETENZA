"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import {
  buildWhatsappMessage,
  getContactChannels,
  normalizeWhatsapp,
  sendLeadEmail,
  whatsappLink,
  type DemoLead,
} from "@/lib/leads/contact";

export interface DemoRequestState {
  status: "idle" | "error" | "ok";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Link para o visitante enviar o pedido também pelo WhatsApp comercial. */
  whatsappUrl?: string | null;
  values?: Record<string, string>;
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(120),
  role: optional(80),
  company: z.string().trim().min(2, "Informe o nome do provedor.").max(120),
  city: optional(120),
  subscribers: optional(40),
  erp: optional(60),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(200),
  whatsapp: z
    .string()
    .trim()
    .refine((v) => normalizeWhatsapp(v) !== null, "Informe o WhatsApp com DDD."),
  message: optional(1500),
  consent: z.literal("on", { message: "É preciso concordar com o uso dos dados para o contato." }),
});

// Limite simples por IP (em memória, por instância): até 5 pedidos a cada 10 minutos.
const recent = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  list.push(now);
  recent.set(ip, list);
  return list.length > 5;
}

const FIELDS = ["name", "role", "company", "city", "subscribers", "erp", "email", "whatsapp", "message"] as const;

export async function requestDemoAction(_prev: DemoRequestState, formData: FormData): Promise<DemoRequestState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));

  // Campo invisível: preenchido apenas por robôs.
  if (String(formData.get("site") ?? "") !== "") return { status: "ok", whatsappUrl: null };

  const parsed = leadSchema.safeParse({ ...values, consent: formData.get("consent") ?? "" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Confira os campos destacados.", fieldErrors, values };
  }

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  if (tooMany(ip)) {
    return { status: "error", message: "Recebemos vários pedidos seguidos. Aguarde alguns minutos e tente de novo.", values };
  }

  const data = parsed.data;
  const lead: DemoLead = {
    name: data.name,
    role: data.role,
    company: data.company,
    city: data.city,
    subscribers: data.subscribers,
    erp: data.erp,
    email: data.email,
    whatsapp: data.whatsapp,
    message: data.message,
  };

  const db = await getDb();
  const [row] = await db
    .insert(schema.demoRequests)
    .values({ ...lead, emailStatus: "not_configured" })
    .returning({ id: schema.demoRequests.id });

  const emailStatus = await sendLeadEmail(lead);
  if (emailStatus !== "not_configured") {
    await db.update(schema.demoRequests).set({ emailStatus }).where(eq(schema.demoRequests.id, row.id));
  }

  const { whatsapp } = getContactChannels();
  return {
    status: "ok",
    whatsappUrl: whatsapp ? whatsappLink(whatsapp, buildWhatsappMessage(lead)) : null,
  };
}
