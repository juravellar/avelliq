import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReceivedEmail } from "./inbox-helpers";

// Runs against a real Postgres only when INTEGRATION_DATABASE_URL is set (see
// the test:integration script); regular test runs skip it.
const databaseUrl = process.env.INTEGRATION_DATABASE_URL;

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  listReceivedEmails: vi.fn(),
  getReceivedEmail: vi.fn(),
}));
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  sendEmail: mocks.sendEmail,
  isEmailConfigured: () => true,
}));
vi.mock("./inbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./inbox")>()),
  listReceivedEmails: mocks.listReceivedEmails,
  getReceivedEmail: mocks.getReceivedEmail,
}));

const NOW = new Date("2026-11-04T12:30:00Z");

const received = (overrides: Partial<ReceivedEmail> = {}): ReceivedEmail => ({
  id: randomUUID(),
  from: "Bruno Lima <bruno@x.com>",
  to: ["sac@mail.avelliq.com.br"],
  subject: "Não consigo agendar",
  created_at: "2026-11-04T12:00:00Z",
  html: null,
  text: "O botão não aparece.",
  message_id: `<${randomUUID()}@mail.x.com>`,
  headers: {},
  authentication: { dmarc: "pass" },
  ...overrides,
});

describe.skipIf(!databaseUrl)("support tickets against Postgres", () => {
  const load = async () => {
    process.env.DATABASE_URL = databaseUrl;
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const tickets = await import("./tickets");
    return { db, schema, ...tickets };
  };

  // A different customer per test: the database is shared.
  let customer: string;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SUPPORT_EMAIL", "sac@mail.avelliq.com.br");
    vi.stubEnv("SUPPORT_INBOX", "");
    vi.stubEnv("EMAIL_FROM", "Avelliq <nao-responda@mail.avelliq.com.br>");
    mocks.sendEmail.mockResolvedValue(undefined);
    customer = `cliente-${randomUUID().slice(0, 8)}@x.com`;
  });

  const messagesOf = async (ticketId: string) => {
    const { getTicket } = await load();
    return (await getTicket(ticketId))!.messages;
  };

  it("opens a ticket and sends the customer its protocol", async () => {
    const { importReceivedEmail } = await load();
    const email = received({ from: `Bruno <${customer}>` });

    const result = await importReceivedEmail(email, NOW);

    expect(result?.opened).toBe(true);
    expect(result?.ticket).toMatchObject({
      customerEmail: customer,
      customerName: "Bruno",
      status: "received",
      inbox: "sac@mail.avelliq.com.br",
      awaitingTeam: true,
    });
    const ack = mocks.sendEmail.mock.calls[0][0];
    expect(ack.to).toBe(customer);
    expect(ack.subject).toMatch(/^Re: \[Avelliq · Protocolo AV-\d{6}\] /);
    expect(ack.headers).toMatchObject({
      "Auto-Submitted": "auto-replied",
      "In-Reply-To": email.message_id,
    });
    const messages = await messagesOf(result!.ticket.id);
    expect(messages.map(({ author }) => author)).toEqual([
      "customer",
      "system",
    ]);
  });

  it("adds the customer's replies to their ticket, by protocol or thread", async () => {
    const { importReceivedEmail } = await load();
    const first = received({ from: customer });
    const opened = (await importReceivedEmail(first, NOW))!.ticket;
    const protocol = `AV-${String(opened.number).padStart(6, "0")}`;

    const bySubject = await importReceivedEmail(
      received({
        from: customer,
        subject: `Re: [Avelliq · Protocolo ${protocol}] Não consigo agendar`,
        created_at: "2026-11-04T12:10:00Z",
      }),
      NOW,
    );
    const byThread = await importReceivedEmail(
      received({
        from: customer,
        subject: "Outra coisa",
        headers: { references: `<x@y> ${first.message_id}` },
        created_at: "2026-11-04T12:20:00Z",
      }),
      NOW,
    );

    expect(bySubject?.opened).toBe(false);
    expect(byThread?.opened).toBe(false);
    expect(byThread?.ticket.id).toBe(opened.id);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("doesn't let a stranger write into a ticket by copying its protocol", async () => {
    const { importReceivedEmail } = await load();
    const opened = (await importReceivedEmail(
      received({ from: customer }),
      NOW,
    ))!.ticket;

    const stranger = await importReceivedEmail(
      received({
        from: "golpe@z.com",
        subject: `Re: [Avelliq · Protocolo AV-${opened.number}]`,
      }),
      NOW,
    );

    expect(stranger?.opened).toBe(true);
    expect(stranger?.ticket.id).not.toBe(opened.id);
  });

  it("opens a new ticket, pointing back, when a finalized one gets a reply", async () => {
    const { db, schema, importReceivedEmail } = await load();
    const { eq } = await import("drizzle-orm");
    const first = received({ from: customer });
    const opened = (await importReceivedEmail(first, NOW))!.ticket;
    await db
      .update(schema.supportTicketsTable)
      .set({ status: "concluded" })
      .where(eq(schema.supportTicketsTable.id, opened.id));

    const reply = await importReceivedEmail(
      received({
        from: customer,
        headers: { "in-reply-to": first.message_id! },
      }),
      NOW,
    );

    expect(reply?.opened).toBe(true);
    expect(reply?.ticket.previousTicketId).toBe(opened.id);
    const messages = await messagesOf(reply!.ticket.id);
    expect(
      messages.some(({ body }) => body?.includes("já estava finalizado")),
    ).toBe(true);
  });

  it("stores each e-mail once", async () => {
    const { importReceivedEmail } = await load();
    const email = received({ from: customer });

    const [a, b] = await Promise.all([
      importReceivedEmail(email, NOW),
      importReceivedEmail(email, NOW),
    ]);
    const again = await importReceivedEmail(email, NOW);

    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect(again).toBeNull();
  });

  it("links the help form's notice to the ticket the form opened", async () => {
    const { createFormTicket, importReceivedEmail, TICKET_HEADER } =
      await load();
    const ticket = await createFormTicket({
      name: "Ana",
      email: customer,
      subject: "Dúvida: horário",
      message: "Como mudo o horário?",
      context: "Conta: user_1",
    });

    const notice = await importReceivedEmail(
      received({
        from: "Avelliq <nao-responda@mail.avelliq.com.br>",
        reply_to: [customer],
        subject: `[Avelliq · Protocolo ${ticket.protocol}] Dúvida: horário`,
        headers: { [TICKET_HEADER.toLowerCase()]: ticket.protocol },
      }),
      NOW,
    );

    expect(notice).toBeNull();
    const messages = await messagesOf(ticket.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].resendEmailId).not.toBeNull();
  });

  it("links the form's notice by its subject when the header is lost", async () => {
    const { createFormTicket, importReceivedEmail } = await load();
    const ticket = await createFormTicket({
      name: "Ana",
      email: customer,
      subject: "Dúvida: horário",
      message: "Como mudo o horário?",
      context: "Conta: user_1",
    });

    const notice = await importReceivedEmail(
      received({
        from: "Avelliq <nao-responda@mail.avelliq.com.br>",
        reply_to: [customer],
        subject: `[Avelliq · Protocolo ${ticket.protocol}] Dúvida: horário`,
      }),
      NOW,
    );

    expect(notice).toBeNull();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("imports new e-mails oldest first and stops at the stored ones", async () => {
    const { importReceivedEmail, syncInbox } = await load();
    const stored = received({ from: customer });
    await importReceivedEmail(stored, NOW);
    const older = received({ from: customer, subject: "Primeiro" });
    const newer = received({ from: customer, subject: "Segundo" });
    mocks.listReceivedEmails.mockResolvedValue({
      data: [newer, older, stored],
      has_more: true,
    });
    mocks.getReceivedEmail.mockImplementation(
      async (id: string) => [newer, older].find((email) => email.id === id)!,
    );

    const waiting = await syncInbox();

    expect(waiting).toBe(0);
    expect(mocks.listReceivedEmails).toHaveBeenCalledTimes(1);
    expect(mocks.getReceivedEmail.mock.calls.map(([id]) => id)).toEqual([
      older.id,
      newer.id,
    ]);
  });

  it("searches and filters tickets, hiding the domain's other mail", async () => {
    const { importReceivedEmail, listTickets } = await load();
    const support = (await importReceivedEmail(
      received({ from: customer, text: `palavra-${customer}` }),
      NOW,
    ))!.ticket;
    await importReceivedEmail(
      received({
        from: customer,
        to: ["financeiro@mail.avelliq.com.br"],
        subject: "Nota fiscal",
      }),
      NOW,
    );

    const byText = await listTickets({
      search: `palavra-${customer}`,
      page: 1,
      seesAll: false,
    });
    expect(byText.rows.map(({ id }) => id)).toEqual([support.id]);

    const byProtocol = await listTickets({
      search: `AV-${support.number}`,
      page: 1,
      seesAll: false,
    });
    expect(byProtocol.rows.map(({ id }) => id)).toContain(support.id);

    const team = await listTickets({
      search: customer,
      page: 1,
      seesAll: false,
    });
    const owner = await listTickets({
      search: customer,
      page: 1,
      seesAll: true,
    });
    expect(team.total).toBe(1);
    expect(owner.total).toBe(2);

    const awaiting = await listTickets({
      search: customer,
      filter: "awaiting",
      page: 1,
      seesAll: true,
    });
    const concluded = await listTickets({
      search: customer,
      filter: "concluded",
      page: 1,
      seesAll: true,
    });
    expect(awaiting.total).toBe(2);
    expect(concluded.total).toBe(0);
  });

  it("exports and deletes a customer's tickets", async () => {
    const { db, importReceivedEmail, ticketsOf, deleteTicketsOf } =
      await load();
    await importReceivedEmail(received({ from: customer }), NOW);

    const exported = await ticketsOf(customer.toUpperCase());
    expect(exported).toHaveLength(1);
    expect(exported[0].protocol).toMatch(/^AV-\d{6}$/);
    expect(exported[0].messages[0]).not.toHaveProperty("userId");

    await deleteTicketsOf(db, customer);
    expect(await ticketsOf(customer)).toHaveLength(0);
  });
});
