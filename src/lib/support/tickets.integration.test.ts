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
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "segredo-dos-testes");
    vi.spyOn(console, "error").mockImplementation(() => {});
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
    const {
      createFormTicket,
      formNoticeHeader,
      importReceivedEmail,
      TICKET_HEADER,
    } = await load();
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
        headers: {
          [TICKET_HEADER.toLowerCase()]: formNoticeHeader(ticket.protocol),
        },
        // Avelliq's own domain publishes no DMARC policy.
        authentication: { spf: "pass", dkim: "pass", dmarc: "gray" },
      }),
      NOW,
    );

    expect(notice).toBeNull();
    const messages = await messagesOf(ticket.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].resendEmailId).not.toBeNull();
    // The team's notice is not an e-mail the customer can be answered on.
    expect(messages[0].messageId).toBeNull();
  });

  it("links the form's notice even after a help-panel reply", async () => {
    const {
      addCustomerMessage,
      createFormTicket,
      formNoticeHeader,
      importReceivedEmail,
      TICKET_HEADER,
    } = await load();
    const ticket = await createFormTicket({
      name: "Ana",
      email: customer,
      subject: "Dúvida: horário",
      message: "Como mudo o horário?",
      context: "Conta: user_1",
    });
    // Also has no e-mail id; only the form's own message may take the notice's.
    await addCustomerMessage(ticket.id, customer, "Ainda estou aqui.");

    const notice = await importReceivedEmail(
      received({
        from: "Avelliq <nao-responda@mail.avelliq.com.br>",
        reply_to: [customer],
        subject: `[Avelliq · Protocolo ${ticket.protocol}] Dúvida: horário`,
        headers: {
          [TICKET_HEADER.toLowerCase()]: formNoticeHeader(ticket.protocol),
        },
        authentication: { spf: "pass", dkim: "pass", dmarc: "gray" },
      }),
      NOW,
    );

    expect(notice).toBeNull();
    const messages = await messagesOf(ticket.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].resendEmailId).not.toBeNull();
    expect(messages[1].resendEmailId).toBeNull();
  });

  it("keeps an auto-reply in the thread without asking the team to answer", async () => {
    const { db, schema, importReceivedEmail, getTicket } = await load();
    const { eq } = await import("drizzle-orm");
    const first = received({ from: customer });
    const opened = (await importReceivedEmail(first, NOW))!.ticket;
    await db
      .update(schema.supportTicketsTable)
      .set({ awaitingTeam: false })
      .where(eq(schema.supportTicketsTable.id, opened.id));

    const auto = await importReceivedEmail(
      received({
        from: customer,
        subject: "Resposta automática: Não consigo agendar",
        headers: {
          "in-reply-to": first.message_id!,
          "auto-submitted": "auto-replied",
        },
        created_at: "2026-11-04T12:10:00Z",
      }),
      NOW,
    );

    expect(auto).toMatchObject({ opened: false });
    expect(auto?.ticket.id).toBe(opened.id);
    const stored = (await getTicket(opened.id))!;
    expect(stored.awaitingTeam).toBe(false);
    expect(stored.messages).toHaveLength(2);
  });

  it("files an auto-reply to a finalized ticket there, without a new ticket", async () => {
    const { db, schema, importReceivedEmail, getTicket } = await load();
    const { eq } = await import("drizzle-orm");
    const first = received({ from: customer });
    const opened = (await importReceivedEmail(first, NOW))!.ticket;
    await db
      .update(schema.supportTicketsTable)
      .set({ status: "concluded", awaitingTeam: false })
      .where(eq(schema.supportTicketsTable.id, opened.id));

    const auto = await importReceivedEmail(
      received({
        from: customer,
        headers: {
          "in-reply-to": first.message_id!,
          "auto-submitted": "auto-replied",
        },
      }),
      NOW,
    );

    expect(auto).toMatchObject({ opened: false });
    const stored = (await getTicket(opened.id))!;
    expect(stored).toMatchObject({ status: "concluded", awaitingTeam: false });
    expect(stored.messages).toHaveLength(2);
  });

  it("still opens a ticket for an auto-reply that matches none", async () => {
    const { importReceivedEmail } = await load();
    const auto = await importReceivedEmail(
      received({
        from: customer,
        headers: { "auto-submitted": "auto-replied" },
      }),
      NOW,
    );

    expect(auto?.opened).toBe(true);
  });

  it("counts a message imported after the team already opened the ticket", async () => {
    const { importReceivedEmail, countNewForTeam, markSeenByTeam } =
      await load();
    const first = received({ from: customer });
    const opened = (await importReceivedEmail(first, NOW))!.ticket;
    await markSeenByTeam(opened.id);
    const before = await countNewForTeam({ seesAll: true });

    // Arrived before the team opened the ticket, imported only afterwards.
    await importReceivedEmail(
      received({
        from: customer,
        headers: { "in-reply-to": first.message_id! },
        created_at: "2026-11-04T12:10:00Z",
      }),
      NOW,
    );

    expect(await countNewForTeam({ seesAll: true })).toBe(before + 1);
  });

  it("drops the notice of a form ticket that was already deleted", async () => {
    const {
      db,
      createFormTicket,
      deleteTicketsOf,
      formNoticeHeader,
      importReceivedEmail,
      ticketsOf,
      TICKET_HEADER,
    } = await load();
    const ticket = await createFormTicket({
      name: "Ana",
      email: customer,
      subject: "Dúvida: horário",
      message: "Como mudo o horário?",
      context: "Conta: user_1",
    });
    await deleteTicketsOf(db, customer);

    const notice = await importReceivedEmail(
      received({
        from: "Avelliq <nao-responda@mail.avelliq.com.br>",
        reply_to: [customer],
        subject: `[Avelliq · Protocolo ${ticket.protocol}] Dúvida: horário`,
        headers: {
          [TICKET_HEADER.toLowerCase()]: formNoticeHeader(ticket.protocol),
        },
        authentication: { spf: "pass", dkim: "pass", dmarc: "gray" },
      }),
      NOW,
    );

    expect(notice).toBeNull();
    expect(await ticketsOf(customer)).toHaveLength(0);
  });

  it("doesn't take an unsigned, unverified notice for the form's", async () => {
    const { createFormTicket, importReceivedEmail, TICKET_HEADER } =
      await load();
    const ticket = await createFormTicket({
      name: "Ana",
      email: customer,
      subject: "Dúvida: horário",
      message: "Como mudo o horário?",
      context: "Conta: user_1",
    });

    const fake = await importReceivedEmail(
      received({
        from: "Avelliq <nao-responda@mail.avelliq.com.br>",
        reply_to: [customer],
        subject: `[Avelliq · Protocolo ${ticket.protocol}] Dúvida`,
        headers: { [TICKET_HEADER.toLowerCase()]: `${ticket.protocol}; falsa` },
        authentication: { dmarc: "gray" },
      }),
      NOW,
    );

    expect(fake?.opened).toBe(true);
  });

  it("doesn't join a reply without a DMARC pass to the ticket", async () => {
    const { importReceivedEmail } = await load();
    const first = received({ from: customer });
    const opened = (await importReceivedEmail(first, NOW))!.ticket;

    for (const authentication of [
      { spf: "pass", dkim: "pass", dmarc: "gray" },
      null,
    ]) {
      const reply = await importReceivedEmail(
        received({
          from: customer,
          headers: { "in-reply-to": first.message_id! },
          authentication,
        }),
        NOW,
      );

      expect(reply?.opened).toBe(true);
      expect(reply?.ticket.id).not.toBe(opened.id);
      expect(reply?.ticket.previousTicketId).toBeNull();
      const messages = await messagesOf(reply!.ticket.id);
      expect(messages.some(({ body }) => body?.includes("DMARC"))).toBe(true);
    }
  });

  it("keys a ticket by the From, not by a Reply-To anyone can set", async () => {
    const { importReceivedEmail } = await load();
    const victim = `vitima-${randomUUID().slice(0, 8)}@x.com`;

    const opened = await importReceivedEmail(
      received({ from: customer, reply_to: [victim] }),
      NOW,
    );

    expect(opened?.ticket.customerEmail).toBe(customer);
    const ack = mocks.sendEmail.mock.calls[0][0];
    expect(ack.to).toBe(customer);

    const followUp = await importReceivedEmail(
      received({
        from: customer,
        subject: `Re: [Avelliq · Protocolo AV-${opened!.ticket.number}]`,
        created_at: "2026-11-04T12:10:00Z",
      }),
      NOW,
    );
    expect(followUp?.opened).toBe(false);
    expect(followUp?.ticket.id).toBe(opened!.ticket.id);
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
        authentication: { dmarc: "pass" },
      }),
      NOW,
    );

    expect(notice).toBeNull();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("only sends protocols for imported mail in production", async () => {
    const { importReceivedEmail } = await load();
    vi.stubEnv("VERCEL_ENV", "preview");

    const result = await importReceivedEmail(received({ from: customer }), NOW);

    expect(result?.opened).toBe(true);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("doesn't join a forged e-mail to the customer's ticket", async () => {
    const { importReceivedEmail } = await load();
    const opened = (await importReceivedEmail(
      received({ from: customer }),
      NOW,
    ))!.ticket;

    const forged = await importReceivedEmail(
      received({
        from: customer,
        subject: `Re: [Avelliq · Protocolo AV-${opened.number}]`,
        authentication: { dmarc: "fail" },
      }),
      NOW,
    );

    expect(forged?.opened).toBe(true);
    expect(forged?.ticket.id).not.toBe(opened.id);
    expect(forged?.ticket.previousTicketId).toBeNull();
    const messages = await messagesOf(forged!.ticket.id);
    expect(messages.some(({ body }) => body?.includes("DMARC"))).toBe(true);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("cuts a huge e-mail", async () => {
    const { importReceivedEmail } = await load();

    const result = await importReceivedEmail(
      received({ from: customer, text: "a".repeat(60_000) }),
      NOW,
    );

    const [first] = await messagesOf(result!.ticket.id);
    expect(first.body!.length).toBeLessThan(50_100);
    expect(first.body).toMatch(/\[mensagem cortada\]$/);
  });

  it("skips an e-mail that can't be imported and goes on", async () => {
    const { syncInbox, listTickets } = await load();
    const { InboxError } = await import("./inbox");
    const broken = received({ from: customer, subject: "Quebrado" });
    const fine = received({ from: customer, subject: "Funciona" });
    mocks.listReceivedEmails.mockResolvedValue({
      data: [fine, broken],
      has_more: false,
    });
    mocks.getReceivedEmail.mockImplementation(async (id: string) => {
      if (id === broken.id) throw new InboxError(500);
      return fine;
    });

    await syncInbox({ pauseMs: 0 });

    const { rows } = await listTickets({
      search: customer,
      page: 1,
      seesAll: true,
    });
    expect(rows.map(({ subject }) => subject)).toEqual(["Funciona"]);
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

    const waiting = await syncInbox({ pauseMs: 0 });

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

  it("shows the customer their tickets and flags new team answers", async () => {
    const {
      db,
      schema,
      importReceivedEmail,
      customerTickets,
      customerTicket,
      countUnreadTickets,
      markSeenByCustomer,
    } = await load();
    const opened = (await importReceivedEmail(
      received({ from: customer }),
      NOW,
    ))!.ticket;
    expect(await countUnreadTickets(customer)).toBe(0);

    await db.insert(schema.supportMessagesTable).values({
      ticketId: opened.id,
      author: "team",
      body: "Veja em Médicos.",
      statusChange: "in_review",
    });

    expect(await countUnreadTickets(customer.toUpperCase())).toBe(1);
    const [listed] = await customerTickets(customer);
    expect(listed).toMatchObject({ id: opened.id, unread: true });

    const ticket = await customerTicket(opened.id, customer);
    // The protocol e-mail note is the team's, not the customer's.
    expect(ticket!.messages.map(({ fromTeam }) => fromTeam)).toEqual([
      false,
      true,
    ]);
    expect(ticket!.messages[1]).not.toHaveProperty("userId");
    expect(await customerTicket(opened.id, "outra@x.com")).toBeNull();

    await markSeenByCustomer(opened.id);
    expect(await countUnreadTickets(customer)).toBe(0);
  });

  it("adds the customer's answer from the help panel, but not to a finished ticket", async () => {
    const { db, schema, importReceivedEmail, addCustomerMessage, getTicket } =
      await load();
    const { eq } = await import("drizzle-orm");
    const opened = (await importReceivedEmail(
      received({ from: customer }),
      NOW,
    ))!.ticket;
    await db
      .update(schema.supportTicketsTable)
      .set({ awaitingTeam: false })
      .where(eq(schema.supportTicketsTable.id, opened.id));

    expect(
      (await addCustomerMessage(opened.id, "outra@x.com", "Oi")).error,
    ).toBe("not-found");
    expect(
      (await addCustomerMessage(opened.id, customer, "Ainda não deu certo."))
        .error,
    ).toBeNull();
    const stored = (await getTicket(opened.id))!;
    expect(stored.awaitingTeam).toBe(true);
    expect(stored.messages.at(-1)).toMatchObject({
      author: "customer",
      body: "Ainda não deu certo.",
    });

    await db
      .update(schema.supportTicketsTable)
      .set({ status: "concluded" })
      .where(eq(schema.supportTicketsTable.id, opened.id));
    expect(await addCustomerMessage(opened.id, customer, "E agora?")).toEqual({
      error: "final",
      protocol: expect.stringMatching(/^AV-/),
    });
  });

  it("counts new customer messages until someone on the team opens them", async () => {
    const { db, schema, importReceivedEmail, countNewForTeam, markSeenByTeam } =
      await load();
    const { eq } = await import("drizzle-orm");
    const before = await countNewForTeam({ seesAll: true });
    const first = received({ from: customer });
    const opened = (await importReceivedEmail(first, NOW))!.ticket;
    expect(await countNewForTeam({ seesAll: true })).toBe(before + 1);

    await markSeenByTeam(opened.id);
    expect(await countNewForTeam({ seesAll: true })).toBe(before);

    // The customer writes again after the team looked: new again.
    await importReceivedEmail(
      received({
        from: customer,
        headers: { "in-reply-to": first.message_id! },
        created_at: new Date(Date.now() + 60_000).toISOString(),
      }),
      NOW,
    );
    expect(await countNewForTeam({ seesAll: true })).toBe(before + 1);

    await db
      .update(schema.supportTicketsTable)
      .set({ status: "concluded" })
      .where(eq(schema.supportTicketsTable.id, opened.id));
    expect(await countNewForTeam({ seesAll: true })).toBe(before);
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

  it("doesn't import again the e-mails of deleted tickets", async () => {
    const { db, importReceivedEmail, deleteTicketsOf, syncInbox, ticketsOf } =
      await load();
    const email = received({ from: customer });
    await importReceivedEmail(email, NOW);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);

    await db.transaction((tx) => deleteTicketsOf(tx, customer));
    const again = await importReceivedEmail(email, NOW);

    expect(again).toBeNull();
    expect(await ticketsOf(customer)).toHaveLength(0);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);

    // The sync sees it as stored too, and stops scanning there.
    mocks.listReceivedEmails.mockResolvedValue({
      data: [{ id: email.id }],
      has_more: true,
    });
    expect(await syncInbox({ pauseMs: 0 })).toBe(0);
    expect(mocks.listReceivedEmails).toHaveBeenCalledTimes(1);
    expect(mocks.getReceivedEmail).not.toHaveBeenCalled();
  });

  it("remembers the e-mails of expired tickets too", async () => {
    const { db, schema, importReceivedEmail, deleteExpiredTickets } =
      await load();
    const { eq } = await import("drizzle-orm");
    const email = received({ from: customer });
    const opened = (await importReceivedEmail(email, NOW))!.ticket;
    await db
      .update(schema.supportTicketsTable)
      .set({ lastMessageAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(schema.supportTicketsTable.id, opened.id));

    const deleted = await deleteExpiredTickets(
      new Date("2021-01-01T00:00:00Z"),
    );

    expect(deleted.map(({ id }) => id)).toContain(opened.id);
    expect(await importReceivedEmail(email, NOW)).toBeNull();
  });
});
