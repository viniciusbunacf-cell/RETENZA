"use client";

import { Download, Upload } from "lucide-react";
import { importCsvAction } from "@/app/actions/data";
import { StatefulForm, SubmitButton } from "@/components/forms";

export function ImportForm({
  kind,
  label,
  description,
  template,
  fields,
  disabled,
}: {
  kind: string;
  label: string;
  description: string;
  template: string;
  fields: { header: string; required: boolean; description: string }[];
  disabled: boolean;
}) {
  return (
    <div className="card flex flex-col px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">{label}</h3>
          <p className="mt-0.5 text-sm text-text-soft">{description}</p>
        </div>
        <a href={template} download className="btn-ghost shrink-0 px-2 py-1 text-xs">
          <Download size={14} aria-hidden="true" /> Modelo
        </a>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-text-soft hover:text-text">Colunas aceitas</summary>
        <ul className="mt-2 space-y-1 text-xs text-text-soft">
          {fields.map((f) => (
            <li key={f.header}>
              <code className="rounded bg-page px-1 py-0.5 text-text">{f.header}</code>
              {f.required ? <span className="ml-1 font-semibold text-critical-ink">obrigatória</span> : null} —{" "}
              {f.description}
            </li>
          ))}
        </ul>
      </details>
      <StatefulForm action={importCsvAction} className="mt-3 space-y-3">
        <input type="hidden" name="kind" value={kind} />
        <input
          type="file"
          name="file"
          accept=".csv,text/csv,text/plain"
          required
          disabled={disabled}
          aria-label={`Arquivo CSV de ${label.toLowerCase()}`}
          className="block w-full text-sm text-text-soft file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line-strong file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text hover:file:bg-page"
        />
        <SubmitButton className="btn-secondary" pendingLabel="Importando e recalculando…">
          <Upload size={15} aria-hidden="true" /> Importar
        </SubmitButton>
      </StatefulForm>
    </div>
  );
}
