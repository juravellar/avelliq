import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  sendEmail: vi.fn(),
  getReceivedEmail: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ recordAudit: mocks.audit }));
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
const admin = { id: "owner", email: "equipe@avelliq.com", emailVerified: true };
const delegated = {
  id: "staff",
  email: "staff@x.com",
  emailVerified: true,
  staffRole: "support",
};

describe("replySupportEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.audit.mockResolvedValue(undefined);
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "equipe@avelliq.com");
    vi.stubEnv("SUPPORT_EMAIL", "sac@mail.avelliq.com.br");
    vi.stubEnv("EMAIL_FROM", "Avelliq <nao-responda@mail.avelliq.com.br>");
    mocks.getSession.mockResolvedValue({ user: admin });
    mocks.getReceivedEmail.mockResolvedValue({
      id: ID,
      from: "Avelliq <nao-responda@mail.avelliq.com.br>",
      to: ["sac@mail.avelliq.com.br"],
      subject: "[Avelliq · Dúvida] Horário do médico",
      created_at: "2026-10-19T15:00:00Z",
      reply_to: ["ana@clinica.com"],
      html: null,
      text: "Nome: Ana\nE-mail: ana@clinica.com\nConta: user_1 · Plano: Free · Clínica: Centro\n\nNão consigo mudar o horário.",
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
    expect(sent.text).toContain("ana@clinica.com escreveu:");
    expect(sent.text).not.toContain("user_1");
    expect(sent.text).toContain("19/10/2026 às 12:00");
    expect(mocks.audit).toHaveBeenCalledWith({
      userId: "owner",
      clinicId: null,
      action: "support.replied",
      entityId: ID,
    });
  });

  it("lets the rest of the team answer only mail sent to the support addresses", async () => {
    mocks.getSession.mockResolvedValue({ user: delegated });
    expect(
      (await replySupportEmail({ id: ID, message: "Olá, Ana!" }))?.data,
    ).toEqual({ sentTo: "ana@clinica.com" });

    mocks.sendEmail.mockClear();
    mocks.getReceivedEmail.mockResolvedValue({
      ...(await mocks.getReceivedEmail.mock.results[0].value),
      to: ["admin@mail.avelliq.com.br"],
    });
    const result = await replySupportEmail({ id: ID, message: "Olá!" });
    expect(result?.serverError).toBe("Acesso negado.");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("refuses anyone who isn't on the team, and QA", async () => {
    for (const user of [
      { email: "cliente@x.com", emailVerified: true },
      { email: "qa@x.com", emailVerified: true, staffRole: "qa" },
    ]) {
      mocks.getSession.mockResolvedValue({ user });
      const result = await replySupportEmail({ id: ID, message: "Oi" });
      expect(result?.serverError).toBe("Acesso negado.");
    }
    expect(mocks.getReceivedEmail).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("doesn't answer Avelliq's own addresses", async () => {
    mocks.getReceivedEmail.mockResolvedValue({
      ...(await mocks.getReceivedEmail()),
      from: "Avelliq <sac@mail.avelliq.com.br>",
      reply_to: [],
    });

    const result = await replySupportEmail({ id: ID, message: "Olá!" });

    expect(result?.serverError).toMatch(/próprio Avelliq/);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("keeps the thread's earlier references", async () => {
    mocks.getReceivedEmail.mockResolvedValue({
      ...(await mocks.getReceivedEmail()),
      headers: { references: "<first@mail>" },
    });

    await replySupportEmail({ id: ID, message: "Olá de novo!" });

    expect(mocks.sendEmail.mock.calls[0][0].headers).toEqual({
      "In-Reply-To": "<original@mail>",
      References: "<first@mail> <original@mail>",
    });
  });

  it("refuses an id that isn't a received e-mail id", async () => {
    const result = await replySupportEmail({ id: "../domains", message: "Oi" });

    expect(result?.validationErrors?.id).toBeDefined();
  });
});
