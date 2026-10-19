import { describe, expect, it } from "vitest";

import {
  addressOf,
  htmlToText,
  inboxPageLinks,
  isHelpFormMessage,
  isOwnAddress,
  nameOf,
  quotedOriginal,
  replySubject,
  replyTarget,
  safeEmailHtml,
  threadHeaders,
} from "./inbox-helpers";

const email = {
  id: "1",
  from: "Avelliq <nao-responda@mail.avelliq.com.br>",
  to: ["sac@mail.avelliq.com.br"],
  subject: "[Avelliq · Dúvida] Como mudo o horário",
  created_at: "2026-10-19T12:00:00Z",
  reply_to: ["ana@clinica.com"],
  html: null,
  text: "Linha 1\nLinha 2",
  message_id: "<abc@mail>",
};

describe("inbox helpers", () => {
  it("answers the help form's sender through its Reply-To", () => {
    expect(replyTarget(email)).toBe("ana@clinica.com");
    expect(isHelpFormMessage(email)).toBe(true);
  });

  it("answers a direct e-mail to whoever sent it", () => {
    const direct = { ...email, from: "Bruno Lima <bruno@x.com>", reply_to: [] };
    expect(replyTarget(direct)).toBe("bruno@x.com");
    expect(isHelpFormMessage({ ...direct, subject: "Dúvida" })).toBe(false);
  });

  it("reads names and addresses from the From header", () => {
    expect(addressOf("Bruno Lima <bruno@x.com>")).toBe("bruno@x.com");
    expect(addressOf("bruno@x.com")).toBe("bruno@x.com");
    expect(nameOf('"Bruno Lima" <bruno@x.com>')).toBe("Bruno Lima");
    expect(nameOf("bruno@x.com")).toBe("bruno@x.com");
  });

  it("prefixes the subject once", () => {
    expect(replySubject("Dúvida")).toBe("Re: Dúvida");
    expect(replySubject("RE: Dúvida")).toBe("RE: Dúvida");
    expect(replySubject(null)).toBe("Re: Sua mensagem");
  });

  it("quotes a direct e-mail below the answer, credited to its sender", () => {
    const direct = {
      ...email,
      from: "Bruno <bruno@x.com>",
      subject: "Dúvida",
      reply_to: [],
    };
    expect(quotedOriginal(direct, "19/10/2026 09:00")).toBe(
      "\n\nEm 19/10/2026 09:00, Bruno <bruno@x.com> escreveu:\n> Linha 1\n> Linha 2",
    );
    expect(quotedOriginal({ ...direct, text: null }, "x")).toBe("");
  });

  it("quotes only the person's message from the help form", () => {
    const form = {
      ...email,
      text: "Nome: Ana\nE-mail: ana@clinica.com\nConta: user_1 · Plano: Free · Clínica: Centro\nPágina: /painel\n\nNão consigo mudar o horário.\n\nObrigada!",
    };
    const quoted = quotedOriginal(form, "19/10/2026 09:00");
    expect(quoted).toBe(
      "\n\nEm 19/10/2026 09:00, ana@clinica.com escreveu:\n> Não consigo mudar o horário.\n> \n> Obrigada!",
    );
    expect(quoted).not.toContain("user_1");
    expect(quoted).not.toContain("nao-responda");
  });

  it("quotes HTML-only e-mails as text", () => {
    const html = {
      ...email,
      subject: "Oi",
      from: "bruno@x.com",
      reply_to: [],
      text: null,
      html: "<style>p{}</style><p>Olá &amp; obrigado</p><div>Linha<br>dois</div>",
    };
    expect(quotedOriginal(html, "x")).toContain(
      "> Olá & obrigado\n> Linha\n> dois",
    );
    expect(htmlToText("<p>a</p>\n\n\n<p>b</p>")).toBe("a\n\nb");
  });

  it("keeps the thread's earlier references", () => {
    expect(
      threadHeaders({
        ...email,
        headers: { references: "<one@mail> <two@mail>" },
      }),
    ).toEqual({
      "In-Reply-To": "<abc@mail>",
      References: "<one@mail> <two@mail> <abc@mail>",
    });
    expect(threadHeaders(email)).toEqual({
      "In-Reply-To": "<abc@mail>",
      References: "<abc@mail>",
    });
    expect(threadHeaders({ ...email, message_id: null })).toBeUndefined();
  });

  it("recognizes Avelliq's own addresses", () => {
    const own = [
      "sac@mail.avelliq.com.br",
      "Avelliq <nao-responda@mail.avelliq.com.br>",
    ];
    expect(isOwnAddress("SAC@mail.avelliq.com.br", own)).toBe(true);
    expect(isOwnAddress("nao-responda@mail.avelliq.com.br", own)).toBe(true);
    expect(isOwnAddress("ana@clinica.com", own)).toBe(false);
    expect(isOwnAddress("ana@clinica.com", [undefined, ""])).toBe(false);
  });

  it("takes the addresses out of links and drops refresh redirects", () => {
    const safe = safeEmailHtml(
      '<meta http-equiv="refresh" content="0;url=https://evil.example"><a href="https://evil.example/?id=1">Clique</a><a class="x"href=\'https://b\'>b</a><form action="https://c"></form><svg><a xlink:href="https://d">d</a></svg>',
    );
    expect(safe).not.toMatch(
      /[\s"'/](?:xlink:)?(?:href|action|formaction)\s*=|refresh/i,
    );
    expect(safe).toContain(">Clique</a>");
  });

  it("links to the pages around the current one", () => {
    const page = { data: [{ id: "a" }, { id: "b" }], has_more: true };
    expect(inboxPageLinks(page, {})).toEqual({
      newer: null,
      older: "/atendimento?depois=b",
    });
    expect(inboxPageLinks(page, { after: "x" })).toEqual({
      newer: "/atendimento?antes=a",
      older: "/atendimento?depois=b",
    });
    expect(
      inboxPageLinks({ ...page, has_more: false }, { before: "x" }),
    ).toEqual({ newer: null, older: "/atendimento?depois=b" });
    expect(
      inboxPageLinks({ data: [], has_more: false }, { after: "x" }),
    ).toEqual({ newer: "/atendimento", older: null });
  });
});
