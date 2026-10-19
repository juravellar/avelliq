// Avelliq owners, by the e-mail they sign in with. Listed in
// SUPPORT_ADMIN_EMAILS (comma-separated) on the server, never in the code: the
// repository is public. Owners see every account and choose the other admins.
const supportOwners = () =>
  (process.env.SUPPORT_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

interface StaffCandidate {
  email: string;
  emailVerified?: boolean | null;
  supportAdmin?: boolean | null;
}

const isOwnerEmail = (email: string) =>
  supportOwners().includes(email.trim().toLowerCase());

// Only a confirmed address counts, so nobody can claim an owner's e-mail by
// signing up with it before the owner does.
export const isSupportOwner = (user: StaffCandidate | null | undefined) =>
  !!user && user.emailVerified === true && isOwnerEmail(user.email);

// Who reads and answers support mail: the owners and the admins they added.
export const isSupportAdmin = (user: StaffCandidate | null | undefined) =>
  isSupportOwner(user) ||
  (!!user && user.emailVerified === true && user.supportAdmin === true);
