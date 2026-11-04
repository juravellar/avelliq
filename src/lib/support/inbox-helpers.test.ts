import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addressOf,
  customerAddress,
  htmlToText,
  isHelpFormMessage,
  isOwnAddress,
  isSupportAddress,
  nameOf,
  replyTarget,
} from "./inbox-helpers";

const FORM_SENDER = "Avelliq <nao-responda@mail.avelliq.com.br>";

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
  authentication: { dmarc: "pass" },
};

describe("inbox helpers", () => {
  beforeEach(() => vi.stubEnv("EMAIL_FROM", FORM_SENDER));
  afterEach(() => vi.unstubAllEnvs());

  it("answers the help form's sender through its Reply-To", () => {
    expect(replyTarget(email)).toBe("ana@clinica.com");
    expect(isHelpFormMessage(email, FORM_SENDER)).toBe(true);
  });

  it("doesn't take an outside e-mail with the form's subject as a form message", () => {
    const forged = { ...email, from: "Golpe <golpe@x.com>" };
    expect(isHelpFormMessage(forged, FORM_SENDER)).toBe(false);
    expect(isHelpFormMessage(email, "")).toBe(false);
    expect(
      isHelpFormMessage(
        { ...email, authentication: { dmarc: "fail" } },
        FORM_SENDER,
      ),
    ).toBe(false);
    expect(
      isHelpFormMessage(
        { ...email, authentication: { dmarc: "pass" } },
        FORM_SENDER,
      ),
    ).toBe(true);
  });

  it("doesn't take an e-mail without an authentication result as a form message", () => {
    expect(
      isHelpFormMessage({ ...email, authentication: null }, FORM_SENDER),
    ).toBe(false);
    expect(
      isHelpFormMessage({ ...email, authentication: undefined }, FORM_SENDER),
    ).toBe(false);
    expect(
      isHelpFormMessage(
        { ...email, authentication: { dmarc: "gray" } },
        FORM_SENDER,
      ),
    ).toBe(false);
  });

  it("takes the Reply-To as the customer only for the help form's notice", () => {
    expect(customerAddress(email)).toBe("ana@clinica.com");

    const direct = {
      ...email,
      from: "Bruno <bruno@x.com>",
      subject: "Dúvida",
      reply_to: ["golpe@z.com"],
    };
    expect(customerAddress(direct)).toBe("bruno@x.com");
    // A notice that can't be vouched for is just an e-mail from Avelliq.
    expect(customerAddress({ ...email, authentication: null })).toBe(
      "nao-responda@mail.avelliq.com.br",
    );
  });

  it("tells mail for the support addresses from the rest of the domain", () => {
    const support = ["Avelliq <sac@mail.avelliq.com.br>", undefined];
    expect(isSupportAddress("Sac <SAC@mail.avelliq.com.br>", support)).toBe(
      true,
    );
    expect(isSupportAddress("admin@mail.avelliq.com.br", support)).toBe(false);
  });

  it("turns HTML-only e-mails into text", () => {
    expect(
      htmlToText(
        "<style>p{}</style><p>Olá &amp; obrigado</p><div>Linha<br>dois</div>",
      ),
    ).toBe("Olá & obrigado\nLinha\ndois");
    expect(htmlToText("<p>a</p>\n\n\n<p>b</p>")).toBe("a\n\nb");
  });

  it("answers a direct e-mail to whoever sent it", () => {
    const direct = { ...email, from: "Bruno Lima <bruno@x.com>", reply_to: [] };
    expect(replyTarget(direct)).toBe("bruno@x.com");
    expect(
      isHelpFormMessage({ ...direct, subject: "Dúvida" }, FORM_SENDER),
    ).toBe(false);
  });

  it("reads names and addresses from the From header", () => {
    expect(addressOf("Bruno Lima <bruno@x.com>")).toBe("bruno@x.com");
    expect(addressOf("bruno@x.com")).toBe("bruno@x.com");
    expect(nameOf('"Bruno Lima" <bruno@x.com>')).toBe("Bruno Lima");
    expect(nameOf("bruno@x.com")).toBe("bruno@x.com");
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
});
