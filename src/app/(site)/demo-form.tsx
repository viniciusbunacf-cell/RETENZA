"use client";

import { useActionState } from "react";
import { CircleCheck, MessageCircle } from "lucide-react";
import { requestDemoAction, type DemoRequestState } from "@/app/actions/leads";
import { SubmitButton } from "@/components/forms";
import { SEGMENT_ORDER, SEGMENTS, type SegmentId } from "@/lib/segments";

const CUSTOMERS = ["Até 500", "500 a 2.000", "2.000 a 10.000", "10.000 a 30.000", "Mais de 30.000"];

function Field({
  id,
  label,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="label">
        {label}
        {optional ? <span className="font-normal text-text-muted"> (opcional)</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-erro`} className="mt-1 text-xs font-medium text-critical-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function DemoForm({ defaultSegment }: { defaultSegment?: SegmentId }) {
  const [state, action] = useActionState<DemoRequestState, FormData>(requestDemoAction, { status: "idle" });
  const errors = state.fieldErrors ?? {};
  const v = state.values ?? {};
  const invalid = (name: string) =>
    errors[name] ? { "aria-invalid": true as const, "aria-describedby": `${name}-erro` } : {};

  if (state.status === "ok") {
    return (
      <div role="status" className="rounded-2xl border border-keep/30 bg-keep-soft p-6 sm:p-8">
        <CircleCheck size={28} className="text-keep" aria-hidden="true" />
        <h3 className="mt-3 text-xl font-semibold text-text">Pedido recebido</h3>
        <p className="mt-2 text-text-soft">
          Obrigado pelo interesse. Vamos responder pelo e-mail ou WhatsApp que você informou para combinar a
          demonstração.
        </p>
        {state.whatsappUrl ? (
          <>
            <p className="mt-4 text-sm text-text-soft">Quer adiantar a conversa? Envie o pedido também pelo WhatsApp.</p>
            <a
              href={state.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-3 bg-keep hover:bg-keep/90"
            >
              <MessageCircle size={16} aria-hidden="true" /> Enviar pelo WhatsApp
            </a>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} noValidate className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2 sm:p-7">
      {/* Campo invisível para filtrar robôs. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="site">Site</label>
        <input id="site" name="site" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Field id="name" label="Seu nome" error={errors.name}>
        <input id="name" name="name" required maxLength={120} autoComplete="name" defaultValue={v.name} className="input" {...invalid("name")} />
      </Field>
      <Field id="role" label="Cargo" optional error={errors.role}>
        <input id="role" name="role" maxLength={80} autoComplete="organization-title" placeholder="Ex.: proprietário, gerente de atendimento" defaultValue={v.role} className="input" />
      </Field>
      <Field id="company" label="Empresa" error={errors.company}>
        <input id="company" name="company" required maxLength={120} autoComplete="organization" defaultValue={v.company} className="input" {...invalid("company")} />
      </Field>
      <Field id="segment" label="Segmento" error={errors.segment}>
        <select id="segment" name="segment" required defaultValue={v.segment ?? defaultSegment ?? ""} className="input" {...invalid("segment")}>
          <option value="">Selecione…</option>
          {SEGMENT_ORDER.map((id) => (
            <option key={id} value={id}>
              {SEGMENTS[id].name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="city" label="Cidade e estado" optional error={errors.city}>
        <input id="city" name="city" maxLength={120} placeholder="Ex.: Uberlândia / MG" defaultValue={v.city} className="input" />
      </Field>
      <Field id="email" label="E-mail" error={errors.email}>
        <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" defaultValue={v.email} className="input" {...invalid("email")} />
      </Field>
      <Field id="whatsapp" label="WhatsApp" error={errors.whatsapp}>
        <input id="whatsapp" name="whatsapp" type="tel" required inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" defaultValue={v.whatsapp} className="input" {...invalid("whatsapp")} />
      </Field>
      <Field id="subscribers" label="Clientes ativos" optional>
        <select id="subscribers" name="subscribers" defaultValue={v.subscribers ?? ""} className="input">
          <option value="">Selecione…</option>
          {CUSTOMERS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>
      <Field id="erp" label="Sistema de gestão" optional>
        <input id="erp" name="erp" maxLength={60} placeholder="Ex.: o sistema que você usa, ou planilhas" defaultValue={v.erp} className="input" />
      </Field>
      <div className="sm:col-span-2">
        <Field id="message" label="O que você quer resolver?" optional error={errors.message}>
          <textarea id="message" name="message" rows={3} maxLength={1500} placeholder="Ex.: clientes somem sem avisar; muitos cancelamentos em uma unidade" defaultValue={v.message} className="input" />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <label className="flex items-start gap-2.5 text-sm text-text-soft">
          <input type="checkbox" name="consent" required defaultChecked={v.consent === "on"} className="mt-0.5 h-4 w-4 shrink-0 accent-brand" {...invalid("consent")} />
          <span>
            Concordo que o RETENZA use estes dados para entrar em contato sobre a demonstração, conforme a{" "}
            <a href="/privacidade" target="_blank" className="link">
              política de privacidade
            </a>
            .
          </span>
        </label>
        {errors.consent ? (
          <p id="consent-erro" className="mt-1 text-xs font-medium text-critical-ink">
            {errors.consent}
          </p>
        ) : null}
      </div>
      {state.status === "error" && state.message ? (
        <p role="alert" className="rounded-lg border border-critical/30 bg-critical-soft px-3 py-2 text-sm text-critical-ink sm:col-span-2">
          {state.message}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <SubmitButton className="btn-primary w-full py-2.5 sm:w-auto" pendingLabel="Enviando…">
          Pedir demonstração
        </SubmitButton>
      </div>
    </form>
  );
}
