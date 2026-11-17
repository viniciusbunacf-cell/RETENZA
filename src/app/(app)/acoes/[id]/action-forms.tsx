"use client";

import { addNoteAction, cancelActionAction, completeActionAction } from "@/app/actions/retention";
import { StatefulForm, SubmitButton } from "@/components/forms";

export function CompleteForm({ actionId }: { actionId: string }) {
  return (
    <StatefulForm action={completeActionAction} className="space-y-3">
      <input type="hidden" name="actionId" value={actionId} />
      <div>
        <label htmlFor="resolution" className="label">
          O que foi feito?
        </label>
        <textarea
          id="resolution"
          name="resolution"
          rows={3}
          required
          minLength={10}
          maxLength={2000}
          placeholder="Ex.: causa corrigida, serviço normalizado e clientes avisados."
          className="input"
        />
      </div>
      <fieldset>
        <legend className="label">Resultado da intervenção</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-text">
          {[
            ["resolved", "Problema resolvido"],
            ["partial", "Resolvido parcialmente"],
            ["not_resolved", "Não resolvido"],
          ].map(([value, label]) => (
            <label key={value} className="inline-flex items-center gap-2">
              <input type="radio" name="outcome" value={value} required className="accent-brand" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton pendingLabel="Registrando…">Concluir e registrar intervenção</SubmitButton>
    </StatefulForm>
  );
}

export function NoteForm({ actionId }: { actionId: string }) {
  return (
    <StatefulForm action={addNoteAction} className="space-y-3">
      <input type="hidden" name="actionId" value={actionId} />
      <label htmlFor="note" className="sr-only">
        Anotação
      </label>
      <textarea
        id="note"
        name="note"
        rows={2}
        required
        maxLength={2000}
        placeholder="Registrar andamento, contato feito ou observação…"
        className="input"
      />
      <SubmitButton className="btn-secondary" pendingLabel="Salvando…">
        Adicionar anotação
      </SubmitButton>
    </StatefulForm>
  );
}

export function CancelForm({ actionId }: { actionId: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-text-soft hover:text-text">Cancelar esta ação</summary>
      <StatefulForm action={cancelActionAction} className="mt-3 space-y-3">
        <input type="hidden" name="actionId" value={actionId} />
        <label htmlFor="reason" className="label">
          Motivo do cancelamento
        </label>
        <input
          id="reason"
          name="reason"
          required
          minLength={5}
          maxLength={500}
          placeholder="Ex.: alerta não se confirmou (falso positivo)"
          className="input"
        />
        <SubmitButton className="btn-danger" pendingLabel="Cancelando…">
          Confirmar cancelamento
        </SubmitButton>
      </StatefulForm>
    </details>
  );
}
