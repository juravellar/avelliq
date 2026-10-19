import { describe, expect, it } from "vitest";

import {
  addressOf,
  isHelpFormMessage,
  nameOf,
  quotedOriginal,
  replySubject,
  replyTarget,
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

  it("quotes the original below the answer", () => {
    expect(quotedOriginal(email, "19/10/2026 09:00")).toBe(
      "\n\nEm 19/10/2026 09:00, Avelliq <nao-responda@mail.avelliq.com.br> escreveu:\n> Linha 1\n> Linha 2",
    );
    expect(quotedOriginal({ ...email, text: null }, "x")).toBe("");
  });
});
