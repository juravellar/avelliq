import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  sendEmail: vi.fn(),
  getTicket: vi.fn(),
  inserted: vi.fn(),
  updated: vi.fn(),
  commit: vi.fn(),
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
vi.mock("@/lib/support/team-queries", () => ({
  getTicket: mocks.getTicket,
}));
vi.mock("@/lib/support/import", () => ({
  customerTicketUrl: async () =>
    "https://www.avelliq.com.br/painel?atendimento=4ef9a417",
}));
vi.mock("@/lib/support/tickets", () => ({
  isSupportTicket: (ticket: { source: string; inbox: string }) =>
    ticket.source === "form" || ticket.inbox === "sac@mail.avelliq.com.br",
}));
vi.mock("@/db", () => ({
  db: {
    transaction: async (run: (tx: unknown) => Promise<void>) => {
      await run({
        insert: () => ({ values: mocks.inserted }),
        update: () => ({
          set: (values: unknown) => ({
            where: () => ({ returning: async () => mocks.updated(values) }),
          }),
        }),
      });
      await mocks.commit();
    },
  },
}));

import { updateSupportTicket } from ".";

const TICKET_ID = "4ef9a417-02e9-4d39-ad75-9611e0fcc33c";
const support = {
  id: "staff",
  email: "staff@x.com",
  emailVerified: true,
  staffRole: "support",
};

const ticket = (overrides = {}) => ({
  id: TICKET_ID,
  number: 7,
  subject: "Horário do médico",
  customerEmail: "ana@clinica.com",
  customerName: "Ana",
  inbox: "sac@mail.avelliq.com.br",
  source: "email",
  status: "received",
  messages: [
    {
      author: "customer",
      body: "Não consigo mudar o horário.",
      messageId: "<one@mail>",
      createdAt: new Date("2026-11-04T12:00:00Z"),
    },
    {
      author: "customer",
      body: "Alguma novidade?",
      messageId: "<two@mail>",
      createdAt: new Date("2026-11-04T13:00:00Z"),
    },
  ],
  ...overrides,
});

describe("updateSupportTicket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPPORT_EMAIL", "sac@mail.avelliq.com.br");
    vi.stubEnv("SUPPORT_ADMIN_EMAILS", "equipe@avelliq.com");
    mocks.getSession.mockResolvedValue({ user: support });
    mocks.getTicket.mockResolvedValue(ticket());
    mocks.sendEmail.mockResolvedValue(undefined);
    mocks.audit.mockResolvedValue(undefined);
    mocks.updated.mockResolvedValue([{ id: TICKET_ID }]);
  });

  it("answers in the thread, with the protocol, and stores the answer", async () => {
    const result = await updateSupportTicket({
      ticketId: TICKET_ID,
      status: "in_review",
      message: "Abra Médicos e clique em Ver detalhes.",
    });

    expect(result?.data).toEqual({
      sentTo: "ana@clinica.com",
      protocol: "AV-000007",
    });
    const sent = mocks.sendEmail.mock.calls[0][0];
    expect(sent).toMatchObject({
      from: "Avelliq <sac@mail.avelliq.com.br>",
      to: "ana@clinica.com",
      subject: "Re: [Avelliq · Protocolo AV-000007] Horário do médico",
      headers: {
        "In-Reply-To": "<two@mail>",
        References: "<one@mail> <two@mail>",
      },
    });
    expect(sent.text).toContain("Protocolo: AV-000007");
    expect(sent.text).toContain("> Alguma novidade?");
    expect(sent.html).toContain("Ver conversa no Avelliq");
    expect(sent.text).toContain("/painel?atendimento=4ef9a417");
    expect(sent.text).not.toContain("contestar");
    expect(mocks.inserted).toHaveBeenCalledWith(
      expect.objectContaining({
        author: "team",
        userId: "staff",
        statusChange: "in_review",
      }),
    );
    expect(mocks.updated).toHaveBeenCalledWith(
      expect.objectContaining({ status: "in_review", awaitingTeam: false }),
    );
    expect(mocks.audit.mock.calls.map(([entry]) => entry.action)).toEqual([
      "support.replied",
      "support.status-changed",
    ]);
  });

  it("tells the customer how to disagree when concluding", async () => {
    await updateSupportTicket({
      ticketId: TICKET_ID,
      status: "concluded",
      message: "Resolvido no seu cadastro.",
    });

    expect(mocks.sendEmail.mock.calls[0][0].text).toContain(
      "Este atendimento foi concluído",
    );
  });

  it("requires a message to conclude or archive", async () => {
    const result = await updateSupportTicket({
      ticketId: TICKET_ID,
      status: "archived",
      message: "",
    });

    expect(result?.serverError).toContain("Escreva uma mensagem");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a one-character message", async () => {
    const result = await updateSupportTicket({
      ticketId: TICKET_ID,
      status: "in_review",
      message: "a",
    });

    expect(result?.validationErrors?.message?._errors).toContain(
      "Escreva a mensagem.",
    );
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("changes only the status, without e-mailing", async () => {
    const result = await updateSupportTicket({
      ticketId: TICKET_ID,
      status: "in_review",
      message: "",
    });

    expect(result?.data?.sentTo).toBeNull();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.updated).toHaveBeenCalledWith({ status: "in_review" });
  });

  it("doesn't touch a finalized ticket", async () => {
    mocks.getTicket.mockResolvedValue(ticket({ status: "concluded" }));

    const result = await updateSupportTicket({
      ticketId: TICKET_ID,
      status: "in_review",
      message: "Reabrindo",
    });

    expect(result?.serverError).toContain("não pode mais ser alterado");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("keeps QA and the domain's other mail out", async () => {
    mocks.getSession.mockResolvedValue({
      user: { ...support, staffRole: "qa" },
    });
    expect(
      (
        await updateSupportTicket({
          ticketId: TICKET_ID,
          status: "in_review",
          message: "Oi",
        })
      )?.serverError,
    ).toBe("Acesso negado.");

    mocks.getSession.mockResolvedValue({ user: support });
    mocks.getTicket.mockResolvedValue(
      ticket({ inbox: "financeiro@mail.avelliq.com.br" }),
    );
    expect(
      (
        await updateSupportTicket({
          ticketId: TICKET_ID,
          status: "in_review",
          message: "Oi",
        })
      )?.serverError,
    ).toBe("Atendimento não encontrado.");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("says the message went out when storing it fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.commit.mockRejectedValue(new Error("connection lost"));

    const result = await updateSupportTicket({
      ticketId: TICKET_ID,
      status: "in_review",
      message: "Resposta",
    });

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(result?.serverError).toContain("Não envie de novo");
  });

  it("sends nothing when someone finalized the ticket in the meantime", async () => {
    mocks.updated.mockResolvedValue([]);

    const result = await updateSupportTicket({
      ticketId: TICKET_ID,
      status: "in_review",
      message: "Resposta",
    });

    expect(result?.serverError).toContain("acabou de ser finalizado");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.inserted).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("stores nothing when the e-mail can't be sent", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("resend down"));

    const result = await updateSupportTicket({
      ticketId: TICKET_ID,
      status: "in_review",
      message: "Resposta",
    });

    expect(result?.serverError).not.toContain("Não envie de novo");
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
