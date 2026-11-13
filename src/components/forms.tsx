"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

export interface FormState {
  error?: string;
  ok?: string;
}

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingLabel,
}: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg border border-critical/30 bg-critical-soft px-3 py-2 text-sm text-critical-ink">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="rounded-lg border border-low/30 bg-low-soft px-3 py-2 text-sm text-low-ink">
        {state.ok}
      </p>
    );
  }
  return null;
}

type StateAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Formulário com estado (mensagem de erro/sucesso) para Server Actions. */
export function StatefulForm({
  action,
  children,
  className,
  messagePosition = "bottom",
}: {
  action: StateAction;
  children: ReactNode;
  className?: string;
  messagePosition?: "top" | "bottom";
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {messagePosition === "top" ? <FormMessage state={state} /> : null}
      {children}
      {messagePosition === "bottom" ? <FormMessage state={state} /> : null}
    </form>
  );
}

/** Botão que dispara uma Server Action sem campos e mostra o resultado ao lado. */
export function ActionButton({
  action,
  children,
  className = "btn-secondary",
  pendingLabel,
  confirmMessage,
}: {
  action: (prev: FormState) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
  confirmMessage?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className="flex flex-col items-start gap-2"
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <SubmitButton className={className} pendingLabel={pendingLabel}>
        {children}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
