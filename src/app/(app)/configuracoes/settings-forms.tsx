"use client";

import { resetRiskConfigAction, saveRiskConfigAction, wipeDataAction } from "@/app/actions/data";
import { createUserAction } from "@/app/actions/users";
import { ActionButton, StatefulForm, SubmitButton } from "@/components/forms";
import { GROUP_LABELS, GROUP_ORDER, RULES } from "@/lib/risk/config";
import type { RiskConfig } from "@/lib/risk/types";

const numberInput = "input w-24 px-2 py-1.5 text-right tabular-nums";

export function RiskConfigForm({ config, editable }: { config: RiskConfig; editable: boolean }) {
  return (
    <StatefulForm action={saveRiskConfigAction} className="space-y-6">
      <fieldset disabled={!editable} className="min-w-0 space-y-6">
        {GROUP_ORDER.map((group) => (
          <div key={group}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-text">{GROUP_LABELS[group]}</h3>
              <label className="flex items-center gap-2 text-sm text-text-soft">
                Teto do grupo
                <input
                  type="number"
                  name={`cap.${group}`}
                  min={0}
                  max={100}
                  defaultValue={config.groupCaps[group]}
                  className={numberInput}
                />
                pts
              </label>
            </div>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[640px] border-collapse">
                <thead className="border-b border-line bg-page/60">
                  <tr>
                    <th className="th w-16">Ativa</th>
                    <th className="th">Regra</th>
                    <th className="th">Limite</th>
                    <th className="th">Pontos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {RULES.filter((r) => r.group === group).map((rule) => (
                    <tr key={rule.id}>
                      <td className="td">
                        <input
                          type="checkbox"
                          name={`rule.${rule.id}.enabled`}
                          defaultChecked={config.rules[rule.id].enabled}
                          aria-label={`Ativar regra ${rule.label}`}
                          className="h-4 w-4 accent-brand"
                        />
                      </td>
                      <td className="td">
                        <p className="font-medium text-text">{rule.label}</p>
                        <p className="text-xs text-text-muted">{rule.description}</p>
                      </td>
                      <td className="td">
                        <label className="flex items-center gap-2 text-xs text-text-soft">
                          <input
                            type="number"
                            name={`rule.${rule.id}.threshold`}
                            min={0}
                            step="any"
                            defaultValue={config.rules[rule.id].threshold}
                            className={numberInput}
                          />
                          <span className="max-w-40">{rule.thresholdLabel}</span>
                        </label>
                      </td>
                      <td className="td">
                        <input
                          type="number"
                          name={`rule.${rule.id}.points`}
                          min={0}
                          max={100}
                          defaultValue={config.rules[rule.id].points}
                          aria-label={`Pontos da regra ${rule.label}`}
                          className={numberInput}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-text">Faixas de risco (pontuação mínima)</h3>
            <div className="space-y-2">
              {(
                [
                  ["critical", "Crítico"],
                  ["high", "Alto"],
                  ["moderate", "Moderado"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between gap-3 text-sm text-text-soft">
                  {label}
                  <input
                    type="number"
                    name={`band.${key}`}
                    min={1}
                    max={100}
                    defaultValue={config.bands[key]}
                    className={numberInput}
                  />
                </label>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-text">Janelas de análise</h3>
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-3 text-sm text-text-soft">
                Janela de observação (dias)
                <input type="number" name="recentDays" min={7} max={90} defaultValue={config.recentDays} className={numberInput} />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-text-soft">
                Chamado ligado à falha de rede (horas)
                <input
                  type="number"
                  name="incidentLinkHours"
                  min={0}
                  max={168}
                  defaultValue={config.incidentLinkHours}
                  className={numberInput}
                />
              </label>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-text">Concentração regional</h3>
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-3 text-sm text-text-soft">
                Mínimo de clientes afetados
                <input
                  type="number"
                  name="cluster.minCustomers"
                  min={2}
                  defaultValue={config.cluster.minCustomers}
                  className={numberInput}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-text-soft">
                Mínimo da base local afetada (%)
                <input
                  type="number"
                  name="cluster.minSharePct"
                  min={1}
                  max={100}
                  defaultValue={config.cluster.minSharePct}
                  className={numberInput}
                />
              </label>
            </div>
          </div>
        </div>
      </fieldset>
      {editable ? (
        <SubmitButton pendingLabel="Salvando e recalculando…">Salvar regras e recalcular risco</SubmitButton>
      ) : null}
    </StatefulForm>
  );
}

export function ResetRiskConfigButton() {
  return (
    <ActionButton
      action={resetRiskConfigAction}
      className="btn-ghost"
      pendingLabel="Restaurando…"
      confirmMessage="Restaurar as regras de risco para a configuração padrão?"
    >
      Restaurar padrão
    </ActionButton>
  );
}

export function CreateUserForm() {
  return (
    <StatefulForm action={createUserAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="new-name" className="label">
          Nome
        </label>
        <input id="new-name" name="name" required maxLength={120} className="input" />
      </div>
      <div>
        <label htmlFor="new-email" className="label">
          E-mail
        </label>
        <input id="new-email" name="email" type="email" required className="input" />
      </div>
      <div>
        <label htmlFor="new-role" className="label">
          Perfil
        </label>
        <select id="new-role" name="role" defaultValue="agent" className="input">
          <option value="agent">Atendente</option>
          <option value="manager">Gestor</option>
          <option value="owner">Proprietário</option>
        </select>
      </div>
      <div>
        <label htmlFor="new-team" className="label">
          Equipe
        </label>
        <select id="new-team" name="team" defaultValue="Atendimento" className="input">
          {["Atendimento", "Equipe técnica", "Retenção", "Financeiro", "Diretoria"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="new-password" className="label">
          Senha inicial
        </label>
        <input
          id="new-password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="input"
        />
        <p className="mt-1 text-xs text-text-muted">Mínimo de 10 caracteres. Compartilhe por um canal seguro.</p>
      </div>
      <div className="space-y-3 sm:col-span-2">
        <SubmitButton pendingLabel="Criando…">Adicionar usuário</SubmitButton>
      </div>
    </StatefulForm>
  );
}

export function WipeDataForm() {
  return (
    <StatefulForm action={wipeDataAction} className="space-y-3">
      <label htmlFor="confirm" className="label">
        Para confirmar, digite EXCLUIR
      </label>
      <input id="confirm" name="confirm" required autoComplete="off" className="input max-w-xs" />
      <SubmitButton className="btn-danger" pendingLabel="Excluindo…">
        Excluir todos os dados operacionais
      </SubmitButton>
    </StatefulForm>
  );
}
