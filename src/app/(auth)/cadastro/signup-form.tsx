"use client";

import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/forms";

const ERPS = ["HubSoft", "IXC Provedor", "SGP", "MK Solutions", "Outro / planilhas"];

export function SignupForm() {
  const [state, action] = useActionState(signupAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="providerName" className="label">
          Nome do provedor
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
            Sistema de gestão (ERP)
          </label>
          <select id="erp" name="erp" className="input" defaultValue="">
            <option value="">Selecione…</option>
            {ERPS.map((erp) => (
              <option key={erp} value={erp}>
                {erp}
              </option>
            ))}
          </select>
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
        Criar conta do provedor
      </SubmitButton>
    </form>
  );
}
