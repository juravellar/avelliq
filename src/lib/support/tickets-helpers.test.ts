import { describe, expect, it } from "vitest";

import type { ReceivedEmail } from "./inbox-helpers";
import {
  cleanSubject,
  isAutomatedEmail,
  isNewForTeam,
  parseProtocol,
  protocolOf,
  protocolSearch,
  quoteMessage,
  referencedMessageIds,
  shouldAcknowledge,
  splitQuotedReply,
  ticketSubject,
  ticketThreadHeaders,
  updateProblem,
} from "./tickets-helpers";

const email: ReceivedEmail = {
  id: "1",
  from: "Bruno <bruno@x.com>",
  to: ["sac@mail.avelliq.com.br"],
  subject: "Dúvida",
  created_at: "2026-11-04T12:00:00Z",
  html: null,
  text: "Oi",
  message_id: "<a@mail>",
  headers: {},
  authentication: { dmarc: "pass" },
};

describe("ticket helpers", () => {
  it("writes and reads protocols", () => {
    expect(protocolOf(123)).toBe("AV-000123");
    expect(parseProtocol("Re: [Avelliq · Protocolo AV-000123] Dúvida")).toBe(
      123,
    );
    expect(parseProtocol("o protocolo av 45 de ontem")).toBe(45);
    expect(parseProtocol("AVENIDA 12")).toBeNull();
    expect(parseProtocol(null)).toBeNull();
    expect(protocolSearch("AV-000123")).toBe(123);
    expect(protocolSearch(" #77 ")).toBe(77);
    expect(protocolSearch("ana")).toBeNull();
  });

  it("keeps one protocol tag and no Re: piles in the subject", () => {
    expect(ticketSubject("AV-000001", "Re: RES: Dúvida")).toBe(
      "[Avelliq · Protocolo AV-000001] Dúvida",
    );
    expect(
      ticketSubject("AV-000001", "Re: [Avelliq · Protocolo AV-000001] Dúvida", {
        reply: true,
      }),
    ).toBe("Re: [Avelliq · Protocolo AV-000001] Dúvida");
    expect(cleanSubject("   ")).toBe("Sua mensagem");
  });

  it("reads the e-mails a reply answers", () => {
    expect(
      referencedMessageIds({
        ...email,
        headers: {
          "in-reply-to": "<b@mail>",
          references: "<a@mail> <b@mail> lixo",
        },
      }),
    ).toEqual(["<b@mail>", "<a@mail>"]);
    expect(referencedMessageIds({ ...email, headers: null })).toEqual([]);
    expect(ticketThreadHeaders(["<a@mail>", "", "<b@mail>"])).toEqual({
      "In-Reply-To": "<b@mail>",
      References: "<a@mail> <b@mail>",
    });
    expect(ticketThreadHeaders([])).toBeUndefined();
  });

  it("doesn't answer automatic e-mails, forged senders or old mail", () => {
    const now = new Date("2026-11-04T13:00:00Z");
    expect(shouldAcknowledge(email, "bruno@x.com", now)).toBe(true);
    expect(
      shouldAcknowledge(
        { ...email, authentication: { dmarc: "fail" } },
        "bruno@x.com",
        now,
      ),
    ).toBe(false);
    expect(
      shouldAcknowledge({ ...email, authentication: null }, "bruno@x.com", now),
    ).toBe(false);
    expect(
      shouldAcknowledge(email, "bruno@x.com", new Date("2026-11-06T12:00:00Z")),
    ).toBe(false);
    const automatic: Record<string, string>[] = [
      { "auto-submitted": "auto-replied" },
      { precedence: "bulk" },
      { "x-autoreply": "yes" },
      { "list-id": "<news.x.com>" },
    ];
    for (const headers of automatic) {
      expect(isAutomatedEmail({ ...email, headers }, "bruno@x.com")).toBe(true);
    }
    expect(
      isAutomatedEmail(
        { ...email, headers: { "auto-submitted": "no" } },
        "a@x",
      ),
    ).toBe(false);
    expect(isAutomatedEmail(email, "MAILER-DAEMON@x.com")).toBe(true);
    expect(isAutomatedEmail(email, "no-reply@loja.com")).toBe(true);
    expect(isAutomatedEmail(email, "noreen@x.com")).toBe(false);
  });

  it("separates the reply from the e-mails quoted below it", () => {
    expect(
      splitQuotedReply(
        "ola\n\nEm 23/10/2026 às 20:01, sac@x escreveu:\n> Nome: Ana\n> oi",
      ),
    ).toEqual({
      reply: "ola",
      quoted: "Em 23/10/2026 às 20:01, sac@x escreveu:\n> Nome: Ana\n> oi",
    });
    expect(splitQuotedReply("Obrigado!\nOn Mon, Bob wrote:\n> x").reply).toBe(
      "Obrigado!",
    );
    expect(splitQuotedReply("só texto")).toEqual({
      reply: "só texto",
      quoted: null,
    });
    expect(splitQuotedReply("> tudo citado")).toEqual({
      reply: "> tudo citado",
      quoted: null,
    });
  });

  it("quotes only what the customer typed", () => {
    expect(
      quoteMessage(
        "Ana",
        "04/11/2026 às 09:00",
        "Oi\nEm ontem, X escreveu:\n> velho",
      ),
    ).toBe("\n\nEm 04/11/2026 às 09:00, Ana escreveu:\n> Oi");
    expect(quoteMessage("Ana", "x", "")).toBe("");
  });

  it("checks the team's update", () => {
    const base = { canEmail: true, message: "" };
    expect(
      updateProblem({ ...base, current: "concluded", next: "in_review" }),
    ).toContain("não pode mais ser alterado");
    expect(
      updateProblem({ ...base, current: "in_review", next: "concluded" }),
    ).toContain("Escreva uma mensagem para o cliente");
    expect(
      updateProblem({ ...base, current: "in_review", next: "in_review" }),
    ).toContain("escolha outro status");
    expect(
      updateProblem({ ...base, current: "received", next: "in_review" }),
    ).toBeNull();
    expect(
      updateProblem({
        ...base,
        message: "Resolvido",
        current: "in_review",
        next: "concluded",
      }),
    ).toBeNull();
    // Avelliq's own address: status only, even when archiving.
    expect(
      updateProblem({
        canEmail: false,
        message: "",
        current: "received",
        next: "archived",
      }),
    ).toBeNull();
    expect(
      updateProblem({
        canEmail: false,
        message: "Oi",
        current: "received",
        next: "received",
      }),
    ).toContain("não há para quem enviar");
  });

  it("tells a message the team hasn't opened from one it has", () => {
    const open = {
      awaitingTeam: true,
      status: "in_review" as const,
      lastMessageAt: new Date("2026-11-04T12:00:00Z"),
      teamSeenAt: null,
    };
    expect(isNewForTeam(open)).toBe(true);
    expect(
      isNewForTeam({ ...open, teamSeenAt: new Date("2026-11-04T12:05:00Z") }),
    ).toBe(false);
    expect(
      isNewForTeam({ ...open, teamSeenAt: new Date("2026-11-04T11:00:00Z") }),
    ).toBe(true);
    expect(isNewForTeam({ ...open, awaitingTeam: false })).toBe(false);
    expect(isNewForTeam({ ...open, status: "archived" })).toBe(false);
  });
});
