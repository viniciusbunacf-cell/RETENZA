"use client";

import { useActionState, useState } from "react";
import { signupAction } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/forms";
import { SEGMENT_ORDER, SEGMENTS, segmentOf, type SegmentId } from "@/lib/segments";

export function SignupForm({ initialSegment }: { initialSegment?: SegmentId }) {
  const [state, action] = useActionState(signupAction, {});
  const [segment, setSegment] = useState<SegmentId | "">(initialSegment ?? "");
  const terms = segment ? segmentOf(segment) : null;
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="segment" className="label">
          Segmento da empresa
        </label>
        <select
          id="segment"
          name="segment"
          required
          className="input"
          value={segment}
          onChange={(e) => setSegment(e.target.value as SegmentId)}
          aria-describedby="segment-hint"
        >
          <option value="">Selecione…</option>
          {SEGMENT_ORDER.map((id) => (
            <option key={id} value={id}>
              {SEGMENTS[id].name}
            </option>
          ))}
        </select>
        <p id="segment-hint" className="mt-1 text-xs text-text-muted">
          {terms
            ? `${terms.examples}. A plataforma vai falar em “${terms.customers}” e “${terms.regions}”.`
            : "Define os termos usados na plataforma. O motor de risco é o mesmo para todos."}
        </p>
      </div>
      <div>
        <label htmlFor="providerName" className="label">
          Nome da empresa
        </label>
        <input id="providerName" name="providerName" required maxLength={120} className="input" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className="label">
            Cidade <span className="font-normal text-text-muted">(opcional)</span>
          </label>
          <input id="city" name="city" maxLength={120} className="input" />
        </div>
        <div>
          <label htmlFor="erp" className="label">
            Sistema de gestão <span className="font-normal text-text-muted">(opcional)</span>
          </label>
          <input
            id="erp"
            name="erp"
            maxLength={60}
            list="erp-suggestions"
            placeholder={terms?.systems[0] ? `Ex.: ${terms.systems[0]}` : "Ex.: planilhas"}
            className="input"
          />
          <datalist id="erp-suggestions">
            {[...(terms?.systems ?? []), "Planilhas"].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>
      <hr className="border-line" />
      <div>
        <label htmlFor="name" className="label">
          Seu nome
        </label>
        <input id="name" name="name" required maxLength={120} autoComplete="name" className="input" />
      </div>
      <div>
        <label htmlFor="email" className="label">
          E-mail de acesso
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="input"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="mt-1 text-xs text-text-muted">
          Mínimo de 10 caracteres.
        </p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingLabel="Criando conta…">
        Criar conta da empresa
      </SubmitButton>
    </form>
  );
}
