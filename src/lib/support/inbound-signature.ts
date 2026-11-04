import { createHmac, timingSafeEqual } from "node:crypto";

// Resend signs its webhooks the Svix way: HMAC-SHA256 of
// "<svix-id>.<svix-timestamp>.<body>" with the secret after "whsec_",
// base64-decoded. The header may list several signatures ("v1,<sig> ...")
// while a secret is being rotated.
const TOLERANCE_SECONDS = 5 * 60;

export const isValidInboundSignature = ({
  secret,
  id,
  timestamp,
  signatures,
  body,
  now = Date.now(),
}: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signatures: string | null;
  body: string;
  now?: number;
}) => {
  if (!secret || !id || !timestamp || !signatures) {
    return false;
  }
  const sentAt = Number(timestamp);
  // An old delivery replayed later is refused.
  if (
    !Number.isFinite(sentAt) ||
    Math.abs(now / 1000 - sentAt) > TOLERANCE_SECONDS
  ) {
    return false;
  }
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(
    createHmac("sha256", key)
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64"),
  );
  return signatures.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    const given = Buffer.from(signature ?? "");
    return (
      version === "v1" &&
      given.length === expected.length &&
      timingSafeEqual(given, expected)
    );
  });
};
