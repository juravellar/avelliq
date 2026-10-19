// Avelliq staff who read and answer support mail, by the e-mail they sign in
// with. Listed in SUPPORT_ADMIN_EMAILS (comma-separated) on the server, never
// in the code: the repository is public.
const supportAdmins = () =>
  (process.env.SUPPORT_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

// Only a confirmed address counts, so nobody can claim an admin's e-mail by
// signing up with it before the admin does.
export const isSupportAdmin = (
  user: { email: string; emailVerified?: boolean | null } | null | undefined,
) =>
  !!user &&
  user.emailVerified === true &&
  supportAdmins().includes(user.email.trim().toLowerCase());
