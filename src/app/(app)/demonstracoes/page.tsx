import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { Card, Notice, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { isPlatformAdmin } from "@/lib/leads/admin";
import { getContactChannels, normalizeWhatsapp } from "@/lib/leads/contact";

export const metadata: Metadata = { title: "Pedidos de demonstração" };

const EMAIL_STATUS: Record<string, { label: string; cls: string }> = {
  sent: { label: "E-mail enviado", cls: "bg-keep-soft text-keep" },
  failed: { label: "Falha no e-mail", cls: "bg-critical-soft text-critical-ink" },
  not_configured: { label: "E-mail não configurado", cls: "bg-page text-text-soft" },
};

export default async function DemoRequestsPage() {
  const user = await requireUser();
  if (!isPlatformAdmin(user.email)) notFound();

  const db = await getDb();
  const rows = await db.select().from(schema.demoRequests).orderBy(desc(schema.demoRequests.createdAt)).limit(200);
  const contact = getContactChannels();
  const emailReady = Boolean(process.env.RESEND_API_KEY && contact.email);

  return (
    <>
      <PageHeader
        title="Pedidos de demonstração"
        description="Contatos recebidos pelo formulário do site. Cada pedido também é enviado por e-mail e o visitante pode enviá-lo pelo WhatsApp."
      />
      {!emailReady ? (
        <Notice tone="warning" className="mb-4">
          O aviso por e-mail não está ativo. Defina RETENZA_CONTATO_EMAIL e RESEND_API_KEY para receber cada pedido
          na caixa de entrada.
        </Notice>
      ) : null}
      {!contact.whatsapp ? (
        <Notice tone="warning" className="mb-4">
          O WhatsApp comercial não está definido. Defina RETENZA_CONTATO_WHATSAPP para o site mostrar o botão de
          WhatsApp.
        </Notice>
      ) : null}
      {rows.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <p className="text-sm text-text-muted">Nenhum pedido recebido ainda.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const wa = normalizeWhatsapp(r.whatsapp);
            const status = EMAIL_STATUS[r.emailStatus] ?? EMAIL_STATUS.not_configured;
            return (
              <li key={r.id} className="card px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-text">
                      {r.company}
                      {r.city ? <span className="font-normal text-text-soft"> · {r.city}</span> : null}
                    </p>
                    <p className="text-sm text-text-soft">
                      {r.name}
                      {r.role ? ` · ${r.role}` : ""}
                      {r.subscribers ? ` · ${r.subscribers} assinantes` : ""}
                      {r.erp ? ` · ${r.erp}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
                    <span className="text-xs text-text-muted">{formatDateTime(r.createdAt)}</span>
                  </div>
                </div>
                {r.message ? <p className="mt-2 text-sm whitespace-pre-line text-text">{r.message}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <a href={`mailto:${r.email}`} className="btn-secondary px-3 py-1.5">
                    {r.email}
                  </a>
                  {wa ? (
                    <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="btn-secondary px-3 py-1.5">
                      WhatsApp {r.whatsapp}
                    </a>
                  ) : (
                    <span className="px-3 py-1.5 text-text-soft">{r.whatsapp}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
