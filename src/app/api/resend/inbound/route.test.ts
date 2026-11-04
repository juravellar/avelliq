import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  valid: vi.fn(),
  production: vi.fn(),
  getReceivedEmail: vi.fn(),
  importReceivedEmail: vi.fn(),
}));
vi.mock("@/lib/support/inbound-signature", () => ({
  isValidInboundSignature: mocks.valid,
}));
vi.mock("@/lib/support/inbox", () => ({
  isInboxConfigured: () => true,
  isInboxEnvironment: () => mocks.production(),
  getReceivedEmail: mocks.getReceivedEmail,
}));
vi.mock("@/lib/support/tickets", () => ({
  importReceivedEmail: mocks.importReceivedEmail,
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("https://www.avelliq.com.br/api/resend/inbound", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

describe("Resend inbound webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_INBOUND_WEBHOOK_SECRET", "whsec_x");
    mocks.valid.mockReturnValue(true);
    mocks.production.mockReturnValue(true);
    mocks.getReceivedEmail.mockResolvedValue({ id: "abc" });
    mocks.importReceivedEmail.mockResolvedValue(null);
  });

  it("imports the received e-mail right away", async () => {
    const response = await post({
      type: "email.received",
      data: { email_id: "abc" },
    });

    expect(response.status).toBe(200);
    expect(mocks.getReceivedEmail).toHaveBeenCalledWith("abc");
    expect(mocks.importReceivedEmail).toHaveBeenCalledWith({ id: "abc" });
  });

  it("refuses an unsigned call and ignores other events", async () => {
    mocks.valid.mockReturnValue(false);
    expect((await post({ type: "email.received" })).status).toBe(401);

    mocks.valid.mockReturnValue(true);
    const other = await post({ type: "email.sent", data: { email_id: "x" } });
    expect(await other.json()).toEqual({ ignored: true });
    expect(mocks.importReceivedEmail).not.toHaveBeenCalled();
  });

  it("asks Resend to retry when the import fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.importReceivedEmail.mockRejectedValue(new Error("db down"));

    const response = await post({
      type: "email.received",
      data: { email_id: "abc" },
    });

    expect(response.status).toBe(500);
  });

  it("acknowledges and ignores the call outside production", async () => {
    mocks.production.mockReturnValue(false);

    const response = await post({
      type: "email.received",
      data: { email_id: "abc" },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ignored: true });
    expect(mocks.getReceivedEmail).not.toHaveBeenCalled();
    expect(mocks.importReceivedEmail).not.toHaveBeenCalled();
  });

  it("is off without its secret", async () => {
    vi.stubEnv("RESEND_INBOUND_WEBHOOK_SECRET", "");
    expect(
      (await post({ type: "email.received", data: { email_id: "abc" } }))
        .status,
    ).toBe(503);
  });
});
