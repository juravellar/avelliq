import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  sendEmail: vi.fn(),
  getReceivedEmail: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEmail: mocks.sendEmail,
  isEmailConfigured: () => true,
}));
vi.mock("@/lib/support/inbox", () => ({
  isInboxConfigured: () => true,
  getReceivedEmail: mocks.getReceivedEmail,
}));

import { replySupportEmail } from ".";

const ID = "4ef9a417-02e9-4d39-ad75-9611e0fcc33c";
const admin = { email: "equipe@avelliq.com", emailVerified: true };

describe("replySupportEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "equipe@avelliq.com");
    vi.stubEnv("SUPPORT_EMAIL", "sac@mail.avelliq.com.br");
    mocks.getSession.mockResolvedValue({ user: admin });
    mocks.getReceivedEmail.mockResolvedValue({
      id: ID,
      from: "Avelliq <nao-responda@mail.avelliq.com.br>",
      to: ["sac@mail.avelliq.com.br"],
      subject: "[Avelliq · Dúvida] Horário do médico",
      created_at: "2026-10-19T15:00:00Z",
      reply_to: ["ana@clinica.com"],
      html: null,
      text: "Não consigo mudar o horário.",
      message_id: "<original@mail>",
    });
  });

  it("answers the person, from the support address, in the same thread", async () => {
    const result = await replySupportEmail({
      id: ID,
      message: "Olá, Ana! Abra Médicos e clique em Ver detalhes.",
    });

    expect(result?.data).toEqual({ sentTo: "ana@clinica.com" });
    const sent = mocks.sendEmail.mock.calls[0][0];
    expect(sent).toMatchObject({
      from: "Avelliq <sac@mail.avelliq.com.br>",
      to: "ana@clinica.com",
      subject: "Re: [Avelliq · Dúvida] Horário do médico",
      headers: {
        "In-Reply-To": "<original@mail>",
        References: "<original@mail>",
      },
    });
    expect(sent.text).toContain("Olá, Ana!");
    expect(sent.text).toContain("> Não consigo mudar o horário.");
    expect(sent.text).toContain("19/10/2026 às 12:00");
  });

  it("refuses anyone who isn't a support admin", async () => {
    mocks.getSession.mockResolvedValue({
      user: { email: "cliente@x.com", emailVerified: true },
    });

    const result = await replySupportEmail({ id: ID, message: "Oi" });

    expect(result?.serverError).toBe("Acesso negado.");
    expect(mocks.getReceivedEmail).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses an id that isn't a received e-mail id", async () => {
    const result = await replySupportEmail({ id: "../domains", message: "Oi" });

    expect(result?.validationErrors?.id).toBeDefined();
  });
});
