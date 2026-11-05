import { createHash } from "node:crypto";

// What is kept of a deleted ticket's received e-mail ids: enough to skip the
// e-mail on the next import, not to find it. Both recording and checking use
// this function (sha256 of the UTF-8 id, in hex). Kept apart from
// tickets-helpers, which client components import: node:crypto is server only.
export const emailIdHash = (resendEmailId: string) =>
  createHash("sha256").update(resendEmailId, "utf8").digest("hex");
