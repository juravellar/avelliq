import type { ReceivedEmail, ReceivedEmailSummary } from "./inbox-helpers";

// Resend's API for the mail received at the verified domain. Only server
// code imports this file: the key reads the whole inbox.
const RECEIVING_URL = "https://api.resend.com/emails/receiving";

// A full-access key, separate from the sending key the app uses everywhere
// else, so the everyday key never needs that much power.
export const isInboxConfigured = () =>
  Boolean(process.env.RESEND_RECEIVING_API_KEY);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isReceivedEmailId = (id: string) => UUID.test(id);

export class InboxError extends Error {
  constructor(
    readonly status: number,
    // The key is missing, invalid or can't read received mail.
    readonly keyProblem = false,
  ) {
    // The status is enough to investigate; bodies may hold personal data.
    super(`Resend receiving API responded ${status}`);
  }
}

// Resend answers an invalid key with 400 ("API key is invalid") and a
// missing or send-only one with 401/403.
const isKeyProblem = async (response: Response) => {
  if (response.status === 401 || response.status === 403) {
    return true;
  }
  if (response.status !== 400) {
    return false;
  }
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  return typeof body?.message === "string" && /api key/i.test(body.message);
};

const call = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${RECEIVING_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.RESEND_RECEIVING_API_KEY}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new InboxError(response.status, await isKeyProblem(response));
  }
  return response.json() as Promise<T>;
};

export const PAGE_SIZE = 30;

// Newest first. `after` is the last id of a page, for the older page after
// it; `before` is the first id of a page, for the newer page before it.
export const listReceivedEmails = (
  cursor: { after?: string; before?: string } = {},
) => {
  const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor.after) query.set("after", cursor.after);
  else if (cursor.before) query.set("before", cursor.before);
  return call<{ data: ReceivedEmailSummary[]; has_more: boolean }>(`?${query}`);
};

export const getReceivedEmail = (id: string) =>
  call<ReceivedEmail>(`/${encodeURIComponent(id)}`);
