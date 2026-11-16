import { afterEach, describe, expect, it } from "vitest";
import {
  buildLeadEmail,
  buildWhatsappMessage,
  formatWhatsapp,
  getContactChannels,
  normalizeWhatsapp,
  whatsappLink,
} from "./contact";

const lead = {
  name: "Ana Souza",
  role: "Proprietária",
  company: "Fibra <Norte>",
  city: "Serra Azul / MG",
  subscribers: "2.000 a 10.000",
  erp: "IXC Provedor",
  email: "ana@fibranorte.example",
  whatsapp: "+55 (31) 98888-7777",
  message: "Queremos testar no piloto.",
};

describe("WhatsApp", () => {
  it("normaliza números brasileiros com e sem DDI", () => {
    expect(normalizeWhatsapp("(11) 91234-5678")).toBe("5511912345678");
    expect(normalizeWhatsapp("+55 11 91234-5678")).toBe("5511912345678");
    expect(normalizeWhatsapp("1132345678")).toBe("551132345678");
    expect(normalizeWhatsapp("12345")).toBeNull();
    expect(normalizeWhatsapp("")).toBeNull();
  });
  it("formata o número para exibição", () => {
    expect(formatWhatsapp("5511912345678")).toBe("+55 (11) 91234-5678");
    expect(formatWhatsapp("551132345678")).toBe("+55 (11) 3234-5678");
  });
  it("monta o link com a mensagem pré-preenchida", () => {
    const text = buildWhatsappMessage(lead);
    expect(text).toContain("Provedor: Fibra <Norte>");
    expect(text).not.toContain("undefined");
    expect(whatsappLink("5511912345678", "Olá & tudo bem?")).toBe(
      "https://wa.me/5511912345678?text=Ol%C3%A1%20%26%20tudo%20bem%3F",
    );
  });
});

describe("e-mail", () => {
  it("escapa o conteúdo enviado pelo visitante", () => {
    const email = buildLeadEmail(lead);
    expect(email.subject).toBe("Pedido de demonstração: Fibra <Norte>");
    expect(email.html).toContain("Fibra &lt;Norte&gt;");
    expect(email.html).not.toContain("<Norte>");
    expect(email.text).toContain("Sistema de gestão: IXC Provedor");
  });
  it("omite campos vazios", () => {
    const email = buildLeadEmail({ ...lead, role: null, message: "" });
    expect(email.text).not.toContain("Cargo");
    expect(email.text).not.toContain("Mensagem");
  });
});

describe("canais de contato", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });
  it("lê e valida as variáveis de ambiente", () => {
    process.env.RETENZA_CONTATO_EMAIL = "contato@retenza.example";
    process.env.RETENZA_CONTATO_WHATSAPP = "(11) 91234-5678";
    expect(getContactChannels()).toEqual({
      email: "contato@retenza.example",
      whatsapp: "5511912345678",
      whatsappDisplay: "+55 (11) 91234-5678",
    });
  });
  it("esconde canais não configurados ou inválidos", () => {
    delete process.env.RETENZA_CONTATO_WHATSAPP;
    process.env.RETENZA_CONTATO_EMAIL = "sem-arroba";
    expect(getContactChannels()).toEqual({ email: null, whatsapp: null, whatsappDisplay: null });
  });
});
