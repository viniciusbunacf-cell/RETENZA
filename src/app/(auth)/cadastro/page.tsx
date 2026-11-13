import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Cadastrar provedor" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-text">Cadastrar meu provedor</h2>
      <p className="mt-1 mb-6 text-sm text-text-soft">
        Crie o ambiente isolado do seu provedor. Você será o proprietário da conta e poderá convidar a equipe depois.
      </p>
      <SignupForm />
      <p className="mt-6 text-sm text-text-soft">
        Já tem conta?{" "}
        <Link href="/login" className="link">
          Entrar
        </Link>
      </p>
    </div>
  );
}
