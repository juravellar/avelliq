import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isEmailConfigured,
  resetPasswordEmail,
  sendEmail,
  supportReplyEmail,
  supportRequestEmail,
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

  it("puts the link in a button and spelled out, with the logo from the app URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.avelliq.com.br/");
    const { html } = verificationEmail("https://x/verify?token=a&b=1");
    expect(
      html.match(/href="https:\/\/x\/verify\?token=a&amp;b=1"/g),
    ).toHaveLength(2);
    expect(html).toContain("Confirmar meu email");
    expect(html).toContain('src="https://www.avelliq.com.br/apple-icon.png"');
  });

  it("escapes support messages inside the layout", () => {
    const reply = supportReplyEmail("<b>Oi</b>", "\n\n> <img src=x>");
    expect(reply.html).not.toContain("<b>Oi</b>");
    expect(reply.html).not.toContain("<img src=x>");
    expect(reply.text).toBe("<b>Oi</b>\n\n> <img src=x>");

    const request = supportRequestEmail({
      topic: "Planos",
      message: "<script>alert(1)</script>",
      name: "Ana <x>",
      email: "ana@exemplo.com",
      page: null,
    });
    expect(request.html).not.toContain("<script>");
    expect(request.html).not.toContain("Ana <x>");
    expect(request.html).toContain("Nova mensagem: Planos");
  });
});
