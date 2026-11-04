// How recently someone must have signed in to do something that can't be
// undone, so a left-open or stolen session can't delete an account.
const FRESH_SESSION_MS = 10 * 60 * 1000;

export const isFreshSession = (
  session: { createdAt?: Date | string | null } | null | undefined,
) => {
  const createdAt = session?.createdAt && new Date(session.createdAt).getTime();
  return !!createdAt && Date.now() - createdAt <= FRESH_SESSION_MS;
};
