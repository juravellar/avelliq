import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(),
  createFormTicket: vi.fn(),
  acknowledge: vi.fn(),
  headers: new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));
vi.mock("@/lib/support/tickets", () => ({
  createFormTicket: mocks.createFormTicket,
  acknowledge: mocks.acknowledge,
  TICKET_HEADER: "X-Avelliq-Protocol",
  formNoticeHeader: (protocol: string) => `${protocol}; assinatura`,
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
    mocks.sendEmail.mockResolvedValue(undefined);
    mocks.acknowledge.mockResolvedValue(undefined);
    mocks.createFormTicket.mockImplementation(async () => ({
      id: "ticket",
      number: 42,
      protocol: "AV-000042",
    }));
    mocks.getSession.mockResolvedValue({
      user: {
        id: `user_${Math.random()}`,
        name: "Ana",
        email: "ana@clinica.com",
        // `plan` sets the limits (unlimited for Avelliq's team); the e-mail
        // shows the plan actually subscribed to.
        plan: "professional",
        subscribedPlan: "essential",
        clinic: { name: "Clínica Centro" },
      },
    });
    vi.stubEnv("SUPPORT_INBOX", "equipe@example.com");
    vi.stubEnv("SUPPORT_EMAIL", "sac@mail.avelliq.com.br");
  });

  it("opens a ticket, tells the team and gives the person the protocol", async () => {
    const result = await sendSupportRequest(request);

    expect(result?.data).toEqual({
      sent: true,
      replyTo: "ana@clinica.com",
      protocol: "AV-000042",
    });
    const ticket = mocks.createFormTicket.mock.calls[0][0];
    expect(ticket).toMatchObject({
      name: "Ana",
      email: "ana@clinica.com",
      message: request.message,
      subject: expect.stringMatching(/^Dúvida: Como faço/),
    });
    expect(ticket.context).toContain("Plano: Essencial");
    expect(ticket.context).toContain("Clínica: Clínica Centro");
    const sent = mocks.sendEmail.mock.calls[0][0];
    expect(sent).toMatchObject({
      to: "equipe@example.com",
      replyTo: "ana@clinica.com",
      subject: expect.stringContaining("[Avelliq · Protocolo AV-000042]"),
      headers: { "X-Avelliq-Protocol": "AV-000042; assinatura" },
    });
    expect(mocks.acknowledge).toHaveBeenCalledWith(
      expect.objectContaining({ number: 42 }),
      [],
    );
  });

  it("keeps the ticket when the team's notice fails", async () => {
    mocks.sendEmail.mockRejectedValue(
      new Error("Email provider responded 500"),
    );

    const result = await sendSupportRequest(request);

    expect(result?.data?.protocol).toBe("AV-000042");
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
    expect(mocks.createFormTicket.mock.calls[0][0].context).toContain(
      "não estava logado",
    );
  });

  it("pretends to send for bots that fill the hidden field", async () => {
    const result = await sendSupportRequest({ ...request, leaveBlank: "spam" });

    expect(result?.data).toEqual({ sent: true });
    expect(mocks.createFormTicket).not.toHaveBeenCalled();
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
    mocks.createFormTicket.mockRejectedValue(new Error("connection refused"));

    const result = await sendSupportRequest(request);

    expect(result?.serverError).toContain("Não foi possível enviar");
    expect(result?.serverError).toContain("sac@mail.avelliq.com.br");
  });

  it("doesn't count messages that failed to send against the limit", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: "unlucky_user", name: "Ana", email: "a@a.com", plan: null },
    });
    mocks.createFormTicket.mockRejectedValue(new Error("connection refused"));
    for (let i = 0; i < SUPPORT_LIMIT.max + 2; i++) {
      await sendSupportRequest(request);
    }
    mocks.createFormTicket.mockResolvedValue({
      id: "t",
      number: 1,
      protocol: "AV-000001",
    });

    expect((await sendSupportRequest(request))?.data?.sent).toBe(true);
  });

  it("ignores an e-mail field with only spaces", async () => {
    mocks.getSession.mockResolvedValue(null);
    const result = await sendSupportRequest({
      ...request,
      name: "Bia",
      email: "   ",
    });

    expect(result?.validationErrors).toBeUndefined();
    expect(result?.serverError).toContain("nome e e-mail");
  });

  it("refuses a message that is too short", async () => {
    const result = await sendSupportRequest({ ...request, message: "ajuda" });

    expect(result?.validationErrors?.message).toBeDefined();
  });
});
