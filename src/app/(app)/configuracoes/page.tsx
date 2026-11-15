import type { Metadata } from "next";
import { asc, desc, eq } from "drizzle-orm";
import { loadDemoDataAction } from "@/app/actions/data";
import { toggleUserAction } from "@/app/actions/users";
import { getDb, schema } from "@/db/client";
import { ActionButton, SubmitButton } from "@/components/forms";
import { Card, CardHeader, Notice, PageHeader } from "@/components/ui";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, canAdminister, canManage, type Role } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { getRiskConfig } from "@/lib/risk/recalculate";
import { CreateUserForm, ResetRiskConfigButton, RiskConfigForm, WipeDataForm } from "./settings-forms";

export const metadata: Metadata = { title: "Configurações" };

const PRIVACY = [
  ["Isolamento por provedor", "Cada consulta é filtrada pelo provedor da sessão; um usuário nunca acessa dados de outro provedor."],
  ["Acesso por função", "Proprietário, gestor e atendente têm permissões diferentes para regras, importações e usuários."],
  ["Minimização de dados", "CPF/CNPJ, endereço completo e dados de pagamento não são importados nem armazenados."],
  ["Score explicável", "Todo score mostra as regras disparadas, as evidências e os pontos. Não há decisão automatizada sobre o cliente."],
  ["Somente leitura", "A plataforma não altera contratos, não bloqueia clientes e não envia mensagens."],
  ["Registro de atividades", "Logins, importações, alterações de regras e ações ficam registrados para auditoria."],
];

export default async function SettingsPage() {
  const user = await requireUser();
  const manage = canManage(user.role);
  const admin = canAdminister(user.role);
  const db = await getDb();
  const [config, users, audit] = await Promise.all([
    getRiskConfig(user.providerId, db),
    db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        team: schema.users.team,
        active: schema.users.active,
      })
      .from(schema.users)
      .where(eq(schema.users.providerId, user.providerId))
      .orderBy(asc(schema.users.name)),
    manage
      ? db
          .select()
          .from(schema.auditLog)
          .where(eq(schema.auditLog.providerId, user.providerId))
          .orderBy(desc(schema.auditLog.createdAt))
          .limit(40)
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Configurações"
        description={`${user.providerName} · regras de risco, usuários, privacidade e registro de atividades.`}
      />

      {user.providerIsDemo && admin ? (
        <Card className="mb-4 px-5 py-4">
          <p className="text-sm font-semibold text-text">Dados de demonstração</p>
          <p className="mt-0.5 mb-3 max-w-2xl text-sm text-text-soft">
            A base fictícia é gerada em relação à data em que foi carregada. Recarregue-a antes de uma apresentação para
            que eventos, prazos e indicadores fiquem atualizados. As ações e anotações registradas serão substituídas.
          </p>
          <ActionButton
            action={loadDemoDataAction}
            pendingLabel="Gerando nova base fictícia…"
            confirmMessage="Substituir os dados atuais por uma nova base fictícia?"
          >
            Recarregar dados de demonstração
          </ActionButton>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Regras de classificação de risco"
          description="Os pesos iniciais são um ponto de partida. Calibre-os com a taxa real de cancelamento do provedor, usando a validação do score em Indicadores."
          right={manage ? <ResetRiskConfigButton /> : null}
        />
        <div className="space-y-4 px-5 py-5">
          <Notice>
            O score soma os pontos das regras disparadas, respeitando o teto de cada grupo, e é limitado a 100. Com os
            tetos padrão, sinais financeiros isolados nunca passam de risco baixo, e o risco crítico exige a
            convergência de pelo menos três grupos de sinais. Chamados técnicos ligados a uma falha de rede já
            registrada não são contados duas vezes.
          </Notice>
          {!manage ? <Notice tone="warning">Apenas proprietários e gestores podem alterar as regras.</Notice> : null}
          <RiskConfigForm config={config} editable={manage} />
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Usuários e permissões" description="O preço do RETENZA não depende do número de usuários internos." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead className="border-b border-line bg-page/60">
              <tr>
                <th className="th">Usuário</th>
                <th className="th">Perfil</th>
                <th className="th">Equipe</th>
                <th className="th">Situação</th>
                {admin ? <th className="th" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="td">
                    <p className="font-medium text-text">{u.name}</p>
                    <p className="text-xs text-text-muted">{u.email}</p>
                  </td>
                  <td className="td">
                    <p className="text-text">{ROLE_LABELS[u.role as Role] ?? u.role}</p>
                    <p className="max-w-64 text-xs text-text-muted">{ROLE_DESCRIPTIONS[u.role as Role]}</p>
                  </td>
                  <td className="td text-text-soft">{u.team ?? "—"}</td>
                  <td className="td">
                    <span
                      className={
                        u.active
                          ? "rounded-full bg-keep-soft px-2.5 py-1 text-xs font-semibold text-keep"
                          : "rounded-full bg-page px-2.5 py-1 text-xs font-semibold text-text-soft"
                      }
                    >
                      {u.active ? "Ativo" : "Desativado"}
                    </span>
                  </td>
                  {admin ? (
                    <td className="td text-right">
                      {u.id !== user.id ? (
                        <form action={toggleUserAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <SubmitButton className="btn-ghost px-2 py-1 text-xs" pendingLabel="…">
                            {u.active ? "Desativar" : "Reativar"}
                          </SubmitButton>
                        </form>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {admin ? (
          <div className="border-t border-line px-5 py-5">
            <h3 className="mb-3 text-sm font-semibold text-text">Adicionar usuário</h3>
            <div className="max-w-2xl">
              <CreateUserForm />
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Privacidade e proteção de dados (LGPD)"
          description="Princípios aplicados na plataforma desde a primeira versão."
        />
        <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
          {PRIVACY.map(([title, text]) => (
            <div key={title} className="bg-white px-5 py-3.5">
              <dt className="text-sm font-semibold text-text">{title}</dt>
              <dd className="mt-0.5 text-sm text-text-soft">{text}</dd>
            </div>
          ))}
        </dl>
        {admin ? (
          <div className="border-t border-line px-5 py-5">
            <h3 className="text-sm font-semibold text-text">Excluir dados do provedor</h3>
            <p className="mt-0.5 mb-3 max-w-2xl text-sm text-text-soft">
              Remove definitivamente clientes, chamados, eventos de rede, faturas, scores e ações. Usuários, regras de
              risco e o registro de atividades são mantidos. Não é possível desfazer.
            </p>
            <WipeDataForm />
          </div>
        ) : null}
      </Card>

      {manage ? (
        <Card className="mt-4 overflow-hidden">
          <CardHeader title="Registro de atividades" description="Últimas 40 atividades registradas." />
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead className="sticky top-0 border-b border-line bg-page">
                <tr>
                  <th className="th">Data</th>
                  <th className="th">Usuário</th>
                  <th className="th">Atividade</th>
                  <th className="th">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td className="td whitespace-nowrap text-text-soft">{formatDateTime(a.createdAt)}</td>
                    <td className="td text-text">{a.userName ?? "Sistema"}</td>
                    <td className="td font-medium text-text">{a.action}</td>
                    <td className="td text-text-soft">{a.detail ?? "—"}</td>
                  </tr>
                ))}
                {audit.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="td py-8 text-center text-text-muted">
                      Nenhuma atividade registrada.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  );
}
