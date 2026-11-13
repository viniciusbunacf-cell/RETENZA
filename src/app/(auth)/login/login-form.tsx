"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/forms";

export function LoginForm({ demo }: { demo: { email: string; password: string } | null }) {
  const [state, action] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={demo?.email}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          defaultValue={demo?.password}
          className="input"
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
