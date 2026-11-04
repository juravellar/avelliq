// Bump when the terms of use or the privacy policy change: every user is
// asked to accept the new version on their next visit.
export const TERMS_VERSION = "2026-11-04";

// Sent by the sign-up form when its acceptance box is checked.
export const ACCEPT_TERMS_HEADER = "x-accept-terms";

export const needsTermsAcceptance = (
  acceptedVersion: string | null | undefined,
) => acceptedVersion !== TERMS_VERSION;

/**
 * The acceptance to store with a new account, or null to refuse it.
 *
 * Email sign-up must come from the form with the box checked. Google sign-up
 * can't carry the box through OAuth, so the notice shown next to the Google
 * button stands as acceptance.
 */
export const termsAcceptanceForNewUser = (
  path: string | undefined,
  acceptedHeader: string | null | undefined,
  now: Date = new Date(),
) => {
  if (path === "/sign-up/email" && acceptedHeader !== TERMS_VERSION) {
    return null;
  }
  return { termsAcceptedAt: now, termsVersion: TERMS_VERSION };
};
