import { FlaskConical } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireUser } from "@/lib/auth/session";
import { getActionCounts } from "@/lib/metrics/dashboard";
import { isPlatformAdmin } from "@/lib/leads/admin";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const counts = await getActionCounts(user.providerId);

  return (
    <div className="min-h-screen">
      <Sidebar
        providerName={user.providerName}
        userName={user.name}
        roleLabel={ROLE_LABELS[user.role]}
        openActions={counts.pending + counts.inProgress}
        showLeads={isPlatformAdmin(user.email)}
      />
      <div className="lg:pl-64">
        {user.providerIsDemo ? (
          <div className="flex items-center justify-center gap-2 border-b border-moderate/40 bg-moderate-soft px-4 py-2 text-center text-xs font-medium text-moderate-ink">
            <FlaskConical size={14} aria-hidden="true" className="shrink-0" />
            Ambiente de demonstração: todos os clientes, eventos e resultados exibidos são fictícios.
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
