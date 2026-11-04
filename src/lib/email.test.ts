import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appUrl,
  isEmailConfigured,
  resetPasswordEmail,
  sendEmail,
  supportReplyEmail,
  supportRequestEmail,
  ticketReceivedEmail,
  verificationEmail,
} from "./email";

describe("email", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is off unless both the API key and the sender are set", () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "Avelliq <no-reply@avelliq.com>");
    expect(isEmailConfigured()).toBe(false);
    vi.stubEnv("RESEND_API_KEY", "re_123");
    expect(isEmailConfigured()).toBe(true);
  });

  it("does not put the recipient in the error when the provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 422 })),
    );

    const sending = sendEmail({
      to: "maria@exemplo.com",
      ...verificationEmail("https://avelliq.vercel.app/x"),
    });

    await expect(sending).rejects.toThrow("Email provider responded 422");
    await expect(sending).rejects.not.toThrow(/maria/);
  });

  it("says how long the reset link lasts and escapes it", () => {
    const email = resetPasswordEmail('https://x/"><script>');
    expect(email.text).toContain("1 hora");
    expect(email.html).not.toContain("<script>");
  });

  it("escapes the link in the HTML body", () => {
    expect(verificationEmail('https://x/"><script>').html).not.toContain(
      "<script>",
    );
  });

  it("puts the link in a button and spelled out", () => {
    const { html } = verificationEmail("https://x/verify?token=a&b=1");
    expect(
      html.match(/href="https:\/\/x\/verify\?token=a&amp;b=1"/g),
    ).toHaveLength(2);
    expect(html).toContain("Confirmar meu email");
  });

  it("links to the app URL but always loads the logo from production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://preview.vercel.app/");
    const { html } = verificationEmail("https://x");
    expect(html).toContain('href="https://preview.vercel.app"');
    expect(html).toContain('src="https://www.avelliq.com.br/apple-icon.png"');
  });

  it("falls back to production when the app URL is empty", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const { html } = verificationEmail("https://x");
    expect(html).not.toContain('href=""');
    expect(html).toContain('href="https://www.avelliq.com.br"');
  });

  it("falls back to the preview's own URL, never to production", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "avelliq-git-x.vercel.app");
    expect(appUrl()).toBe("https://avelliq-git-x.vercel.app");

    vi.stubEnv("VERCEL_ENV", "production");
    expect(appUrl()).toBe("https://www.avelliq.com.br");
  });

  it("prefers the configured app URL over the preview's", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com/");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "avelliq-git-x.vercel.app");
    expect(appUrl()).toBe("https://app.example.com");
  });

  it("keeps the card at 560px in Outlook, which ignores max-width", () => {
    const { html } = verificationEmail("https://x");
    expect(html).toContain(
      '<!--[if mso]><table role="presentation" width="560"',
    );
    expect(html).toContain("<!--[if mso]></td></tr></table><![endif]-->");
  });

  it("escapes support messages inside the layout", () => {
    const reply = supportReplyEmail({
      answer: "<b>Oi</b>",
      quoted: "\n\n> <img src=x>",
      protocol: "AV-000007",
    });
    expect(reply.html).not.toContain("<b>Oi</b>");
    expect(reply.html).not.toContain("<img src=x>");
    expect(reply.text).toBe(
      "<b>Oi</b>\n\nProtocolo: AV-000007\n\n> <img src=x>",
    );

    const request = supportRequestEmail(
      {
        topic: "Planos",
        message: "<script>alert(1)</script>",
        name: "Ana <x>",
        email: "ana@exemplo.com",
        page: null,
      },
      "AV-000008",
    );
    expect(request.html).not.toContain("<script>");
    expect(request.html).not.toContain("Ana <x>");
    expect(request.html).toContain("Nova mensagem: Planos");
    expect(request.subject).toBe(
      "[Avelliq · Protocolo AV-000008] Planos: <script>alert(1)</script>",
    );
  });

  it("tells the customer how to disagree when the answer ends the ticket", () => {
    vi.stubEnv("SUPPORT_EMAIL", "sac@mail.avelliq.com.br");
    const open = supportReplyEmail({
      answer: "Veja em Médicos.",
      quoted: "",
      protocol: "AV-000007",
    });
    expect(open.text).not.toContain("contestar");
    expect(open.html).toContain("é só responder este email");

    const concluded = supportReplyEmail({
      answer: "Resolvido.",
      quoted: "",
      protocol: "AV-000007",
      finalStatusName: "concluído",
    });
    expect(concluded.text).toContain("Este atendimento foi concluído");
    expect(concluded.text).toContain("abra um novo atendimento");
    expect(concluded.text).toContain("sac@mail.avelliq.com.br");
    expect(concluded.html).not.toContain("é só responder este email");
  });

  it("adds the conversation button only when there is a link", () => {
    const withLink = ticketReceivedEmail(
      "AV-000042",
      "https://www.avelliq.com.br/painel?atendimento=t1",
    );
    expect(withLink.html).toContain("Ver conversa no Avelliq");
    expect(withLink.html).toContain(
      'href="https://www.avelliq.com.br/painel?atendimento=t1"',
    );
    expect(ticketReceivedEmail("AV-000042").html).not.toContain(
      "Ver conversa no Avelliq",
    );
  });

  it("gives the protocol of a new ticket", () => {
    const email = ticketReceivedEmail("AV-000042");
    expect(email.text).toContain("Seu protocolo é AV-000042");
    expect(email.html).toContain("AV-000042");
    expect(email.text).toContain("Não aceitamos anexos");
  });
});
