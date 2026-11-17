import type { Metadata } from "next";
import { desc, eq, sql } from "drizzle-orm";
import { CircleCheck, Clock, Lock } from "lucide-react";
import { loadDemoDataAction } from "@/app/actions/data";
import { getDb, rowsOf, schema } from "@/db/client";
import { ActionButton } from "@/components/forms";
import { Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { canAdminister, canManage } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime, formatInt } from "@/lib/format";
import { FIELD_SPECS, IMPORT_KINDS } from "@/lib/import/parse";
import { segmentOf } from "@/lib/segments";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Integrações" };

const ISP_CONNECTORS = [
  {
    name: "HubSoft",
    status: "Próximo conector",
    text: "API oficial com clientes, financeiro, atendimento e rede. Candidato ao primeiro conector, conforme o ERP do provedor-piloto.",
  },
  { name: "IXC Provedor", status: "Em avaliação", text: "Será priorizado conforme a demanda dos provedores-piloto." },
  { name: "SGP", status: "Em avaliação", text: "Será priorizado conforme a demanda dos provedores-piloto." },
  { name: "MK Solutions", status: "Em avaliação", text: "Será priorizado conforme a demanda dos provedores-piloto." },
];

function connectorsFor(segment: string) {
  const seg = segmentOf(segment);
  if (seg.id === "provedor") return ISP_CONNECTORS;
  return seg.systems.slice(0, 4).map((name) => ({
    name,
    status: "Em avaliação",
    text: "Será priorizado conforme a demanda das empresas-piloto do segmento.",
  }));
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const seg = segmentOf(user.segment);
  const connectors = connectorsFor(user.segment);
  const welcome = (await searchParams).bemvindo === "1";
  const manage = canManage(user.role);
  const db = await getDb();

  const [volumes] = rowsOf<{
    customers: number;
    cancelled: number;
    tickets: number;
    events: number;
    usage: number;
    invoices: number;
  }>(
    await db.execute(sql`
      select (select count(*) from customers where provider_id = ${user.providerId})::int as customers,
             (select count(*) from customers where provider_id = ${user.providerId} and status = 'cancelled')::int as cancelled,
             (select count(*) from tickets where provider_id = ${user.providerId})::int as tickets,
             (select count(*) from network_events where provider_id = ${user.providerId})::int as events,
             (select coalesce(sum(quantity), 0) from usage_records where provider_id = ${user.providerId})::int as usage,
             (select count(*) from invoices where provider_id = ${user.providerId})::int as invoices
    `),
  );
  const history = await db
    .select()
    .from(schema.imports)
    .where(eq(schema.imports.providerId, user.providerId))
    .orderBy(desc(schema.imports.createdAt))
    .limit(15);

  const kindLabel = (kind: string) => IMPORT_KINDS.find((k) => k.kind === kind)?.label ?? kind;
  const isEmpty = Number(volumes?.customers ?? 0) === 0;

  return (
    <>
      <PageHeader
        title="Integrações"
        description="O RETENZA se conecta aos sistemas que a empresa já usa. Nesta fase os dados entram por arquivos CSV exportados do sistema de gestão ou de planilhas; os conectores diretos virão um de cada vez."
      />

      {welcome ? (
        <Notice className="mb-4">
          <strong className="font-semibold text-text">Conta criada.</strong> O próximo passo é importar a base de
          {seg.customers} (incluindo quem cancelou nos últimos 6 a 12 meses) e, em seguida, o que você tiver: uso do
          serviço ({seg.usage}), chamados, falhas no serviço e faturas. Quanto mais fontes, mais precisa a leitura de risco.
        </Notice>
      ) : null}

      <div className="mb-4 flex gap-2.5 rounded-lg border border-brand/30 bg-brand-soft px-3.5 py-3 text-sm text-brand-strong">
        <Lock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>
          <strong className="font-semibold">Somente leitura.</strong> O RETENZA apenas lê os dados necessários para
          calcular o risco. Ele não altera contratos, não bloqueia clientes e não envia mensagens. Por minimização de
          dados, CPF/CNPJ, endereço completo e dados de pagamento não são importados.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Clientes", volumes?.customers],
          ["Cancelamentos", volumes?.cancelled],
          ["Chamados", volumes?.tickets],
          ["Registros de uso", volumes?.usage],
          ["Falhas no serviço", volumes?.events],
          ["Faturas", volumes?.invoices],
        ].map(([label, value]) => (
          <div key={label} className="card px-4 py-3">
            <p className="text-sm text-text-soft">{label}</p>
            <p className="mt-0.5 text-xl font-semibold text-text tabular-nums">{formatInt(Number(value ?? 0))}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 flex items-center gap-2 text-base font-semibold text-text">
        Importação por CSV
        <span className="inline-flex items-center gap-1 rounded-full bg-keep-soft px-2 py-0.5 text-xs font-semibold text-keep">
          <CircleCheck size={12} aria-hidden="true" /> Disponível
        </span>
      </h2>
      {!manage ? (
        <Notice className="mb-3">Apenas proprietários e gestores podem importar dados.</Notice>
      ) : (
        <p className="mb-3 max-w-3xl text-sm text-text-soft">
          Comece pelo arquivo de clientes: os demais são vinculados pelo <code>id_cliente</code>. Aceita separador
          vírgula ou ponto e vírgula, datas no formato brasileiro e arquivos em UTF-8 ou Windows-1252. Reimportar um
          arquivo atualiza os registros existentes, sem duplicar. Ao final de cada importação o risco é recalculado.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {IMPORT_KINDS.map((k) => (
          <ImportForm
            key={k.kind}
            kind={k.kind}
            label={k.label}
            description={k.description}
            template={k.template}
            disabled={!manage}
            fields={FIELD_SPECS[k.kind].map((f) => ({
              header: f.header,
              required: f.required,
              description: f.description,
            }))}
          />
        ))}
      </div>

      {isEmpty && canAdminister(user.role) ? (
        <Card className="mt-4 px-5 py-4">
          <p className="text-sm font-semibold text-text">Quer conhecer a plataforma antes de importar?</p>
          <p className="mt-0.5 mb-3 text-sm text-text-soft">
            Carregue uma base fictícia (um provedor de internet com 1.800 assinantes e 12 meses de histórico) para ver
            o radar, as ações e os indicadores funcionando. Você pode excluí-la depois em
            Configurações.
          </p>
          <ActionButton action={loadDemoDataAction} pendingLabel="Carregando dados fictícios…">
            Carregar dados de demonstração
          </ActionButton>
        </Card>
      ) : null}

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Histórico de importações" />
        {history.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-muted">Nenhuma importação realizada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="border-b border-line bg-page/60">
                <tr>
                  <th className="th">Data</th>
                  <th className="th">Arquivo</th>
                  <th className="th">Tipo</th>
                  <th className="th text-right">Importadas</th>
                  <th className="th text-right">Com erro</th>
                  <th className="th">Por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((h) => (
                  <tr key={h.id} className="align-top">
                    <td className="td whitespace-nowrap text-text-soft">{formatDateTime(h.createdAt)}</td>
                    <td className="td">
                      <p className="font-medium text-text">{h.filename ?? "—"}</p>
                      {h.errors && h.errors.length > 0 ? (
                        <details className="mt-1 text-xs text-text-soft">
                          <summary className="cursor-pointer text-critical-ink">Ver erros</summary>
                          <ul className="mt-1 space-y-0.5">
                            {h.errors.map((e, i) => (
                              <li key={i}>{e}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </td>
                    <td className="td text-text-soft">{kindLabel(h.kind)}</td>
                    <td className="td text-right tabular-nums">{formatInt(h.rowsOk)}</td>
                    <td className="td text-right tabular-nums">{formatInt(h.rowsError)}</td>
                    <td className="td text-text-soft">{h.userName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <h2 className="mt-8 mb-3 text-base font-semibold text-text">Conectores diretos</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {connectors.map((c) => (
          <div key={c.name} className="card px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text">{c.name}</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-page px-2 py-0.5 text-xs font-medium text-text-soft">
                <Clock size={12} aria-hidden="true" /> {c.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-text-soft">{c.text}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-text-muted">
        Os conectores ainda não estão implementados. Cada um será desenvolvido conforme o sistema das empresas que
        participarem do piloto, sempre com credenciais de leitura e acesso mínimo necessário. Usa outro sistema
        ou planilhas? Salve o arquivo em CSV (Excel e Google Planilhas fazem isso) e importe acima.
      </p>
    </>
  );
}
