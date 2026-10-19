// A small per-instance limit for the support form: enough to stop a stuck
// button or a script from flooding the inbox. Like the sign-in limit, it is
// kept in memory, so on several instances the real limit is approximate.
export const SUPPORT_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

const sent = new Map<string, number[]>();

export const allowSupportRequest = (key: string, now = Date.now()) => {
  const recent = (sent.get(key) ?? []).filter(
    (time) => now - time < SUPPORT_LIMIT.windowMs,
  );
  if (recent.length >= SUPPORT_LIMIT.max) {
    sent.set(key, recent);
    return false;
  }
  sent.set(key, [...recent, now]);
  return true;
};
