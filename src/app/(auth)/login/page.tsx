import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { DEMO_EMAIL, DEMO_PASSWORD, ensureDemoProvider, isDemoModeEnabled } from "@/lib/demo/seed";
import { Notice } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  const demo = isDemoModeEnabled();
  if (demo) await ensureDemoProvider();

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-text">Entrar no RETENZA</h2>
      <p className="mt-1 mb-6 text-sm text-text-soft">Acesse a central de retenção do seu provedor.</p>
      {demo ? (
        <Notice className="mb-5">
          <strong className="font-semibold text-text">Modo demonstração.</strong> Os campos já estão preenchidos com
          o acesso de um provedor fictício ({DEMO_EMAIL}). Todos os dados exibidos são simulados.
        </Notice>
      ) : null}
      <LoginForm demo={demo ? { email: DEMO_EMAIL, password: DEMO_PASSWORD } : null} />
      <p className="mt-6 text-sm text-text-soft">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="link">
          Cadastrar meu provedor
        </Link>
      </p>
    </div>
  );
}
