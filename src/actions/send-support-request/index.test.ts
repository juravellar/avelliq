import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(),
  headers: new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("next/headers", () => ({ headers: async () => mocks.headers }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEmail: mocks.sendEmail,
  isEmailConfigured: mocks.isEmailConfigured,
}));

import { SUPPORT_LIMIT } from "@/lib/support/rate-limit";

import { sendSupportRequest } from ".";

const request = {
  topic: "duvida" as const,
  message: "Como faço para mudar o horário de um médico?",
};

describe("sendSupportRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.isEmailConfigured.mockReturnValue(true);
    mocks.getSession.mockResolvedValue({
      user: {
        id: `user_${Math.random()}`,
        name: "Ana",
        email: "ana@clinica.com",
        plan: "essential",
        clinic: { name: "Clínica Centro" },
      },
    });
    vi.stubEnv("SUPPORT_INBOX", "equipe@example.com");
    vi.stubEnv("SUPPORT_EMAIL", "sac@mail.avelliq.com.br");
  });

  it("e-mails the team with the account, replying to the user", async () => {
    const result = await sendSupportRequest(request);

    expect(result?.data).toEqual({ sent: true, replyTo: "ana@clinica.com" });
    const sent = mocks.sendEmail.mock.calls[0][0];
    expect(sent).toMatchObject({
      to: "equipe@example.com",
      replyTo: "ana@clinica.com",
      subject: expect.stringContaining("[Avelliq · Dúvida]"),
    });
    expect(sent.text).toContain("Plano: Essencial");
    expect(sent.text).toContain("Clínica: Clínica Centro");
    expect(sent.text).toContain(request.message);
  });

  it("asks a signed-out visitor for name and e-mail", async () => {
    mocks.getSession.mockResolvedValue(null);

    const missing = await sendSupportRequest(request);
    expect(missing?.serverError).toContain("Informe seu nome e e-mail");

    const ok = await sendSupportRequest({
      ...request,
      name: "Bruno",
      email: "bruno@example.com",
    });
    expect(ok?.data?.replyTo).toBe("bruno@example.com");
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain(
      "não estava logado",
    );
  });

  it("pretends to send for bots that fill the hidden field", async () => {
    const result = await sendSupportRequest({ ...request, website: "spam" });

    expect(result?.data).toEqual({ sent: true });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("points to the public address when e-mail isn't configured", async () => {
    mocks.isEmailConfigured.mockReturnValue(false);

    const result = await sendSupportRequest(request);

    expect(result?.serverError).toContain("sac@mail.avelliq.com.br");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("limits how many messages one person sends per hour", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "same_user", name: "Ana", email: "a@a.com", plan: null },
    });
    for (let i = 0; i < SUPPORT_LIMIT.max; i++) {
      expect((await sendSupportRequest(request))?.data?.sent).toBe(true);
    }
    const blocked = await sendSupportRequest(request);
    expect(blocked?.serverError).toContain("várias mensagens");
  });

  it("explains a failed send instead of a generic error", async () => {
    mocks.sendEmail.mockRejectedValue(
      new Error("Email provider responded 500"),
    );

    const result = await sendSupportRequest(request);

    expect(result?.serverError).toContain("Não foi possível enviar");
    expect(result?.serverError).toContain("sac@mail.avelliq.com.br");
  });

  it("refuses a message that is too short", async () => {
    const result = await sendSupportRequest({ ...request, message: "ajuda" });

    expect(result?.validationErrors?.message).toBeDefined();
  });
});
