import type { Metadata } from "next";
import { getContactChannels } from "@/lib/leads/contact";

export const metadata: Metadata = { title: "Privacidade" };

export default function PrivacyPage() {
  const contact = getContactChannels();
  const channel = contact.email
    ? `pelo e-mail ${contact.email}`
    : contact.whatsapp
      ? `pelo WhatsApp ${contact.whatsappDisplay}`
      : "pelos canais de contato indicados no site";

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-text sm:text-4xl">Privacidade</h1>
      <p className="mt-3 text-text-soft">Como o RETENZA trata os dados informados neste site e na plataforma.</p>

      <div className="mt-10 space-y-8 leading-relaxed text-text">
        <section>
          <h2 className="text-xl font-semibold">Pedido de demonstração</h2>
          <p className="mt-2 text-text-soft">
            Ao pedir uma demonstração, você informa nome, cargo, empresa, segmento, cidade, e-mail, WhatsApp,
            faixa de clientes, sistema de gestão e uma mensagem. Usamos esses dados apenas para responder ao pedido e
            conversar sobre a demonstração. Eles não são vendidos nem compartilhados com terceiros, exceto com os
            serviços que usamos para hospedar o site e enviar e-mails.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">Dados dos clientes na plataforma</h2>
          <p className="mt-2 text-text-soft">
            Na plataforma, a empresa contratante é a controladora dos dados dos seus clientes e o RETENZA atua como
            operador. Os dados ficam isolados por empresa, o acesso aos sistemas da empresa é somente de leitura e
            não importamos CPF, CNPJ, endereço completo ou dados de pagamento. O score de risco orienta a equipe da
            empresa e não é usado para tomar decisões automáticas sobre o cliente.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold">Seus direitos</h2>
          <p className="mt-2 text-text-soft">
            Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento {channel}.
          </p>
        </section>
      </div>
    </article>
  );
}
