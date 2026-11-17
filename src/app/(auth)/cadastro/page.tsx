import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { isSegmentId } from "@/lib/segments";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Criar conta" };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ segmento?: string }> }) {
  if (await getSessionUser()) redirect("/painel");
  const { segmento } = await searchParams;
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-text">Criar a conta da empresa</h2>
      <p className="mt-1 mb-6 text-sm text-text-soft">
        Crie o ambiente isolado da sua empresa. Você será o proprietário da conta e poderá convidar a equipe depois.
      </p>
      <SignupForm initialSegment={segmento && isSegmentId(segmento) ? segmento : undefined} />
      <p className="mt-6 text-sm text-text-soft">
        Já tem conta?{" "}
        <Link href="/login" className="link">
          Entrar
        </Link>
      </p>
    </div>
  );
}
