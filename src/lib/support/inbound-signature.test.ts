import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { isValidInboundSignature } from "./inbound-signature";

const key = Buffer.from("chave-de-teste-do-webhook").toString("base64");
const secret = `whsec_${key}`;
const now = 1_793_000_000_000;
const timestamp = String(now / 1000);
const body = '{"type":"email.received","data":{"email_id":"abc"}}';
const sign = (content: string) =>
  createHmac("sha256", Buffer.from(key, "base64"))
    .update(content)
    .digest("base64");

const valid = {
  secret,
  id: "msg_1",
  timestamp,
  signatures: `v1,${sign(`msg_1.${timestamp}.${body}`)}`,
  body,
  now,
};

describe("isValidInboundSignature", () => {
  it("accepts Resend's signature, also among several during a rotation", () => {
    expect(isValidInboundSignature(valid)).toBe(true);
    expect(
      isValidInboundSignature({
        ...valid,
        signatures: `v1,outra ${valid.signatures}`,
      }),
    ).toBe(true);
  });

  it("refuses a changed body, another secret or missing headers", () => {
    expect(isValidInboundSignature({ ...valid, body: `${body} ` })).toBe(false);
    expect(
      isValidInboundSignature({
        ...valid,
        secret: `whsec_${Buffer.from("outra").toString("base64")}`,
      }),
    ).toBe(false);
    expect(isValidInboundSignature({ ...valid, signatures: null })).toBe(false);
    expect(isValidInboundSignature({ ...valid, secret: "" })).toBe(false);
  });

  it("refuses an old delivery replayed later", () => {
    expect(
      isValidInboundSignature({ ...valid, now: now + 6 * 60 * 1000 }),
    ).toBe(false);
  });
});
