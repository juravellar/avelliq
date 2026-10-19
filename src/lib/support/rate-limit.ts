// A small per-instance limit for the support form: enough to stop a stuck
// button or a script from flooding the inbox. Like the sign-in limit, it is
// kept in memory, so on several instances the real limit is approximate.
export const SUPPORT_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

// Past this many senders, expired ones are swept, so the map can't grow
// forever on a long-lived instance.
const SWEEP_AT = 1000;

const sent = new Map<string, number[]>();

const recentOf = (key: string, now: number) =>
  (sent.get(key) ?? []).filter((time) => now - time < SUPPORT_LIMIT.windowMs);

const sweep = (now: number) => {
  for (const key of sent.keys()) {
    if (recentOf(key, now).length === 0) {
      sent.delete(key);
    }
  }
};

// Takes a slot for this sender, or returns null when the limit is reached.
// The returned function gives the slot back, for a message that failed to
// send and so shouldn't count.
export const takeSupportSlot = (key: string, now = Date.now()) => {
  if (sent.size >= SWEEP_AT) {
    sweep(now);
  }
  const recent = recentOf(key, now);
  if (recent.length >= SUPPORT_LIMIT.max) {
    sent.set(key, recent);
    return null;
  }
  sent.set(key, [...recent, now]);
  return () => {
    const left = [...(sent.get(key) ?? [])];
    const index = left.indexOf(now);
    if (index >= 0) {
      left.splice(index, 1);
    }
    if (left.length > 0) {
      sent.set(key, left);
    } else {
      sent.delete(key);
    }
  };
};

export const trackedSenders = () => sent.size;

// Who is sending, for the limit: the account when signed in; otherwise the
// IP that Vercel's proxy sets in x-real-ip. The first x-forwarded-for entry
// can come from the client itself, so it is only a fallback for other hosts.
export const senderKey = (userId: string | undefined, headers: Headers) =>
  userId ??
  headers.get("x-real-ip")?.trim() ??
  headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  "anonymous";
