import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  customerTickets: vi.fn(),
  customerTicket: vi.fn(),
  markSeen: vi.fn(),
  addMessage: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));
vi.mock("@/lib/support/inbox-refresh", () => ({ refreshInboxSoon: () => {} }));
vi.mock("@/lib/support/tickets", () => ({
  customerTickets: mocks.customerTickets,
  customerTicket: mocks.customerTicket,
  markSeenByCustomer: mocks.markSeen,
  addCustomerMessage: mocks.addMessage,
}));

import { getMyTicket, listMyTickets, replyMyTicket } from ".";

const TICKET_ID = "4ef9a417-02e9-4d39-ad75-9611e0fcc33c";
const user = { id: "u1", email: "ana@clinica.com", emailVerified: true };

describe("my support tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user });
    mocks.customerTickets.mockResolvedValue([
      {
        id: TICKET_ID,
        number: 7,
        subject: "Horário",
        status: "in_review",
        lastMessageAt: new Date("2026-11-04T12:00:00Z"),
        unread: true,
      },
    ]);
    mocks.customerTicket.mockResolvedValue({
      id: TICKET_ID,
      protocol: "AV-000007",
      subject: "Horário",
      status: "in_review",
      messages: [],
    });
    mocks.addMessage.mockResolvedValue({ error: null });
  });

  it("lists the tickets of the signed-in person's e-mail", async () => {
    const result = await listMyTickets();

    expect(mocks.customerTickets).toHaveBeenCalledWith("ana@clinica.com");
    expect(result?.data).toEqual([
      {
        id: TICKET_ID,
        protocol: "AV-000007",
        subject: "Horário",
        status: "in_review",
        lastMessageAt: "2026-11-04T12:00:00.000Z",
        unread: true,
      },
    ]);
  });

  it("shows nothing until the e-mail is confirmed", async () => {
    mocks.getSession.mockResolvedValue({
      user: { ...user, emailVerified: false },
    });

    expect((await listMyTickets())?.serverError).toContain(
      "Confirme seu e-mail",
    );
    expect((await getMyTicket({ ticketId: TICKET_ID }))?.serverError).toContain(
      "Confirme seu e-mail",
    );
    expect(mocks.customerTickets).not.toHaveBeenCalled();
    expect(mocks.customerTicket).not.toHaveBeenCalled();
  });

  it("opens a ticket and marks the team's answers as seen", async () => {
    const result = await getMyTicket({ ticketId: TICKET_ID });

    expect(mocks.customerTicket).toHaveBeenCalledWith(
      TICKET_ID,
      "ana@clinica.com",
    );
    expect(mocks.markSeen).toHaveBeenCalledWith(TICKET_ID);
    expect(result?.data?.protocol).toBe("AV-000007");
  });

  it("doesn't open someone else's ticket", async () => {
    mocks.customerTicket.mockResolvedValue(null);

    const result = await getMyTicket({ ticketId: TICKET_ID });

    expect(result?.serverError).toBe("Atendimento não encontrado.");
    expect(mocks.markSeen).not.toHaveBeenCalled();
  });

  it("tells how to disagree with a finished ticket", async () => {
    mocks.addMessage.mockResolvedValue({
      error: "final",
      protocol: "AV-000007",
    });

    const result = await replyMyTicket({
      ticketId: TICKET_ID,
      message: "Não concordo.",
    });

    expect(result?.serverError).toContain("abra um novo atendimento");
    expect(result?.serverError).toContain("AV-000007");
  });
});
