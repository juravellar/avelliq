"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { actionClient } from "@/lib/next-safe-action";
import { canSeeSupportInbox, isSupportOwner } from "@/lib/support/admin";
import { refreshInboxSoon } from "@/lib/support/inbox-refresh";
import { countNewForTeam } from "@/lib/support/team-queries";

// How many tickets wait for the team, polled by the alert in the header.
export const getSupportAlert = actionClient.action(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!canSeeSupportInbox(session?.user)) {
    return { awaiting: 0 };
  }
  refreshInboxSoon();
  return {
    awaiting: await countNewForTeam({
      seesAll: isSupportOwner(session?.user),
    }),
  };
});
