import { afterEach, describe, expect, it, vi } from "vitest";

import { InboxError, isReceivedEmailId, listReceivedEmails } from "./inbox";

const respond = (status: number, body: unknown) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("Resend receiving client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists received mail with the receiving key, newest page first", async () => {
    vi.stubEnv("RESEND_RECEIVING_API_KEY", "re_full");
    const fetchMock = respond(200, { data: [], has_more: false });

    await listReceivedEmails("4ef9a417-02e9-4d39-ad75-9611e0fcc33c");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://api.resend.com/emails/receiving?limit=30&after=4ef9a417-02e9-4d39-ad75-9611e0fcc33c",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_full",
    );
  });

  it("tells a key problem apart from other failures", async () => {
    respond(400, { name: "validation_error", message: "API key is invalid" });
    await expect(listReceivedEmails()).rejects.toMatchObject({
      status: 400,
      keyProblem: true,
    });

    respond(401, {
      name: "restricted_api_key",
      message: "This key can only send",
    });
    await expect(listReceivedEmails()).rejects.toMatchObject({
      keyProblem: true,
    });

    respond(500, { message: "internal" });
    const error = await listReceivedEmails().catch((caught) => caught);
    expect(error).toBeInstanceOf(InboxError);
    expect(error.keyProblem).toBe(false);
  });

  it("only accepts Resend's ids, so a path can't be smuggled in", () => {
    expect(isReceivedEmailId("4ef9a417-02e9-4d39-ad75-9611e0fcc33c")).toBe(
      true,
    );
    expect(isReceivedEmailId("../domains")).toBe(false);
  });
});
